from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView 
from rest_framework.authtoken.models import Token 
from django.db import models
from django.contrib.auth import get_user_model 

# FIREBASE CONFIGURATION
import myprjct.firebase_config  # Triggers the initialization logic
from firebase_admin import auth # Used for verification and correct exception handling

# ✅ ADDED TodoRequest to imports
from .models import Todo, TodoRequest 
from .serializers import TodoSerializer

User = get_user_model()

# ---------------- FIREBASE GOOGLE LOGIN ----------------
class FirebaseGoogleLoginView(APIView):
    """
    Receives Firebase ID Token from frontend, verifies it using Firebase Admin SDK, 
    and issues a Django Token for the corresponding user.
    """
    permission_classes = [] # Allow unauthenticated access for login
    
    def post(self, request):
        id_token = request.data.get('idToken')

        if not id_token:
            return Response({'detail': 'ID Token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # ✅ FIX: Added clock_skew_seconds=10 to handle timing mismatches between systems
            decoded_token = auth.verify_id_token(id_token, clock_skew_seconds=10)
            uid = decoded_token.get('uid')
            email = decoded_token.get('email')
            display_name = decoded_token.get('name', 'User')

            # Find or Create the Django User
            user, created = User.objects.get_or_create(
                username=uid, 
                defaults={
                    'email': email,
                    'first_name': display_name.split(' ')[0],
                    'last_name': ' '.join(display_name.split(' ')[1:]) if len(display_name.split(' ')) > 1 else '',
                    'is_active': True,
                }
            )

            # Manually set a random password if the user was just created
            if created:
                random_password = User.objects.make_random_password()
                user.set_password(random_password)
                user.save()
            
            if not created and not user.email:
                user.email = email
                user.save()

            # Get or Create Django Auth Token for the React frontend
            token, _ = Token.objects.get_or_create(user=user)

            return Response({
                'token': token.key,
                'username': user.first_name if user.first_name else user.username,
                'message': 'Login successful'
            }, status=status.HTTP_200_OK)

        # ✅ FIX: Catching correct exception types from 'auth' module
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
    """List all todos for the user or create a new todo."""
    if request.method == 'GET':
        todos = Todo.objects.filter(
            is_deleted=False
        ).filter(
            models.Q(owner=request.user) | models.Q(shared_with=request.user)
        )
        serializer = TodoSerializer(todos, many=True)
        return Response(serializer.data)

    if request.method == 'POST':
        serializer = TodoSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(owner=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ---------------- TODO DETAIL ----------------
@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def todo_detail(request, pk):
    """Retrieve, update, or delete a specific todo."""
    try:
        todo = Todo.objects.get(pk=pk)
    except Todo.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if todo.owner != request.user and request.user not in todo.shared_with.all():
        return Response(
            {"error": "You do not have permission to access this todo"},
            status=status.HTTP_403_FORBIDDEN
        )

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
        todo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------- SHARE TODO ----------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def share_todo(request, pk):
    """Instead of immediate share, creates a pending request."""
    try:
        todo = Todo.objects.get(pk=pk)
    except Todo.DoesNotExist:
        return Response({"error": "Todo not found"}, status=status.HTTP_404_NOT_FOUND)

    if todo.owner != request.user:
        return Response({"error": "Only owner can share this todo"}, status=status.HTTP_403_FORBIDDEN)

    username = request.data.get("username")
    try:
        # ✅ Added a check to look for user by first_name OR username to match your frontend login
        receiver = User.objects.filter(models.Q(username=username) | models.Q(first_name=username)).first()
        if not receiver:
            raise User.DoesNotExist
    except User.DoesNotExist:
        return Response({"error": "User does not exist"}, status=status.HTTP_404_NOT_FOUND)

    if receiver == request.user:
        return Response({"error": "Cannot share with yourself"}, status=status.HTTP_400_BAD_REQUEST)

    # Create the invitation request
    TodoRequest.objects.get_or_create(
        todo=todo,
        sender=request.user,
        receiver=receiver,
        status='pending'
    )
    return Response({"message": f"Invitation sent to {username}!"}, status=status.HTTP_201_CREATED)

# ---------------- LIST RECEIVED REQUESTS ----------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_requests(request):
    """View pending invitations sent to the current user."""
    reqs = TodoRequest.objects.filter(receiver=request.user, status='pending')
    data = [
        {
            "id": r.id, 
            "todo_title": r.todo.title, 
            "from": r.sender.username,
            "todo_id": r.todo.id
        } for r in reqs
    ]
    return Response(data)

# ---------------- HANDLE REQUEST (ACCEPT/DECLINE) ----------------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def handle_request(request, pk):
    """Accept or decline a share invitation."""
    try:
        todo_req = TodoRequest.objects.get(pk=pk, receiver=request.user)
    except TodoRequest.DoesNotExist:
        return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)

    action = request.data.get("action") # 'accept' or 'decline'

    if action == "accept":
        todo_req.status = "accepted"
        todo_req.todo.shared_with.add(request.user)
        todo_req.save()
        return Response({"message": "Invitation accepted!"})
    elif action == "decline":
        todo_req.delete() # Simply remove the request
        return Response({"message": "Invitation declined."})
    
    return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)