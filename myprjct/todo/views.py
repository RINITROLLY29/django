from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView 
from rest_framework.authtoken.models import Token 
from django.db import models
from django.contrib.auth import get_user_model 

# FIREBASE CONFIGURATION
import myprjct.firebase_config  
from firebase_admin import auth 

from .models import Todo, TodoRequest 
from .serializers import TodoSerializer

User = get_user_model()

# ---------------- FIREBASE GOOGLE LOGIN ----------------
class FirebaseGoogleLoginView(APIView):
    permission_classes = [] 
    
    def post(self, request):
        id_token = request.data.get('idToken')
        if not id_token:
            return Response({'detail': 'ID Token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decoded_token = auth.verify_id_token(id_token, clock_skew_seconds=10)
            uid = decoded_token.get('uid')
            email = decoded_token.get('email')
            display_name = decoded_token.get('name', 'User')

            user, created = User.objects.get_or_create(
                username=uid, 
                defaults={
                    'email': email,
                    'first_name': display_name.split(' ')[0],
                    'last_name': ' '.join(display_name.split(' ')[1:]) if len(display_name.split(' ')) > 1 else '',
                    'is_active': True,
                }
            )

            if created:
                random_password = User.objects.make_random_password()
                user.set_password(random_password)
                user.save()
            
            if not created and not user.email:
                user.email = email
                user.save()

            token, _ = Token.objects.get_or_create(user=user)

            return Response({
                'token': token.key,
                'username': user.first_name if user.first_name else user.username,
                'message': 'Login successful'
            }, status=status.HTTP_200_OK)

        except auth.InvalidIdTokenError:
            return Response({'detail': 'Invalid Firebase ID Token.'}, status=status.HTTP_401_UNAUTHORIZED)
        except auth.ExpiredIdTokenError:
            return Response({'detail': 'Firebase ID Token has expired.'}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({'detail': f'Authentication failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---------------- TODO LIST ----------------
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def todo_list(request):
    if request.method == 'GET':
        todos = Todo.objects.filter(
            models.Q(owner=request.user) | models.Q(shared_with=request.user)
        ).distinct()
        serializer = TodoSerializer(todos, many=True)
        return Response(serializer.data)

    if request.method == 'POST':
        serializer = TodoSerializer(data=request.data)
        if serializer.is_valid():
            todo = serializer.save(owner=request.user)
            collaborators = TodoRequest.objects.filter(sender=request.user, status='accepted').values_list('receiver', flat=True)
            todo.shared_with.add(*collaborators)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------- TODO DETAIL ----------------
# ---------------- TODO DETAIL ----------------
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def todo_detail(request, pk):
    try:
        todo = Todo.objects.get(pk=pk)
    except Todo.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if todo.owner != request.user and request.user not in todo.shared_with.all():
        return Response({"error": "No permission"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        serializer = TodoSerializer(todo)
        return Response(serializer.data)

    if request.method == 'PATCH':
        serializer = TodoSerializer(todo, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        # Check if it's already in the bin. If so, PURGE it.
        if todo.is_deleted:
            todo.delete() # This actually removes it from the DB
            return Response({"message": "Successfully purged from database."}, status=status.HTTP_204_NO_CONTENT)
        
        # If it's not in the bin yet, just move it there
        todo.is_deleted = True
        todo.save()
        return Response({"message": "Moved to trash"}, status=status.HTTP_204_NO_CONTENT)


# ---------------- PERMANENT DELETE (PURGE) ----------------
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def permanent_delete(request, pk):
    try:
        # We look for the todo specifically to delete it
        todo = Todo.objects.get(pk=pk)
        
        # Only the owner can purge. 
        # If you want collaborators to be able to purge, remove this IF block.
        if todo.owner != request.user:
            return Response({"error": "Only the original owner can permanently purge tasks."}, status=status.HTTP_403_FORBIDDEN)

        todo.delete() # This is the command that actually clears the database
        return Response({"message": "Successfully purged from database."}, status=status.HTTP_204_NO_CONTENT)
        
    except Todo.DoesNotExist:
        return Response({"error": "Task not found."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ---------------- SHARE ENTIRE BOARD (BY EMAIL) ----------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def share_todo(request): 
    email = request.data.get("username") 
    
    try:
        receiver = User.objects.filter(email=email).first()
        if not receiver:
            return Response({"error": "User with this email not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception:
        return Response({"error": "Search failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if receiver == request.user:
        return Response({"error": "You cannot share the board with yourself!"}, status=status.HTTP_400_BAD_REQUEST)

    TodoRequest.objects.get_or_create(
        sender=request.user,
        receiver=receiver,
        status='pending',
        is_notified=False
    )
    return Response({"message": f"Board access request sent to {email}!"}, status=status.HTTP_201_CREATED)

# ---------------- LIST BOARD REQUESTS ----------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_requests(request):
    received = TodoRequest.objects.filter(receiver=request.user, status='pending')
    sent = TodoRequest.objects.filter(sender=request.user).exclude(status='pending').filter(is_notified=False)
    
    data = []
    for r in (received | sent):
        data.append({
            "id": r.id, 
            "todo_title": "Entire Board",
            "from": r.sender.username,
            "to_user": r.receiver.username,
            "status": r.status,
            "is_receiver": r.receiver == request.user
        })
    return Response(data)


# ---------------- PERMANENT DELETE (PURGE) ----------------
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def permanent_delete(request, pk):
    try:
        todo = Todo.objects.get(pk=pk)
        
        if todo.owner != request.user:
            return Response({"error": "Only the original owner can permanently purge tasks."}, status=status.HTTP_403_FORBIDDEN)

        todo.delete()
        return Response({"message": "Successfully purged from database."}, status=status.HTTP_204_NO_CONTENT)
        
    except Todo.DoesNotExist:
        return Response({"error": "Task not found."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---------------- HANDLE BOARD REQUEST ----------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def handle_request(request, pk):
    try:
        todo_req = TodoRequest.objects.get(
            models.Q(pk=pk, receiver=request.user) | models.Q(pk=pk, sender=request.user)
        )
    except TodoRequest.DoesNotExist:
        return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)

    action = request.data.get("action")

    if action == "accept":
        todo_req.status = "accepted"
        todo_req.is_notified = False 
        todo_req.save()
        
        sender_todos = Todo.objects.filter(owner=todo_req.sender)
        for t in sender_todos:
            t.shared_with.add(todo_req.receiver)
            
        return Response({"message": "Board access accepted!"})
    
    elif action == "decline":
        todo_req.status = "declined"
        todo_req.is_notified = False 
        todo_req.save()
        return Response({"message": "Invitation declined."})

    elif action == "clear":
        todo_req.is_notified = True
        todo_req.save()
        return Response({"message": "Notification cleared."})
    
    return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

# ---------------- LIST COLLABORATORS (NEW) ----------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_collaborators(request):
    """Returns users who have accepted access to your board."""
    accepted_requests = TodoRequest.objects.filter(sender=request.user, status='accepted')
    
    collaborators = []
    for req in accepted_requests:
        collaborators.append({
            "id": req.id,
            "email": req.receiver.email,
            "name": req.receiver.first_name if req.receiver.first_name else req.receiver.username,
        })
    
    return Response(collaborators)


# ---------------- REMOVE COLLABORATOR ----------------
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_collaborator(request, pk):
    try:
        # Only the sender (Owner) can delete an accepted request to "kick" someone
        todo_req = TodoRequest.objects.get(pk=pk, sender=request.user, status='accepted')
        
        # Remove the receiver from all of the owner's tasks before deleting the request
        owner_todos = Todo.objects.filter(owner=request.user)
        for t in owner_todos:
            t.shared_with.remove(todo_req.receiver)
            
        todo_req.delete()
        return Response({"message": "Collaborator removed"}, status=status.HTTP_204_NO_CONTENT)
    except TodoRequest.DoesNotExist:
        return Response({"error": "Collaborator not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)
    


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_collaborators(request):
    # 1. Get people I invited (I am the owner)
    my_guests = TodoRequest.objects.filter(sender=request.user, status='accepted')
    
    # 2. Get the person who invited me (I am a guest)
    my_owners = TodoRequest.objects.filter(receiver=request.user, status='accepted')
    
    collabs = []
    
    # Add guests to the list
    for req in my_guests:
        collabs.append({
            "id": req.id, 
            "name": req.receiver.username, 
            "role": "Guest"
        })
        
    # Add the owner to the list
    for req in my_owners:
        collabs.append({
            "id": req.id, 
            "name": req.sender.username, 
            "role": "Owner"
        })
        
    return Response(collabs)