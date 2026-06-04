from django.urls import path
from . import views

urlpatterns = [
    # API endpoints for CRUD operations
    path('todos/', views.todo_list, name='todo-list'),
    path('todos/<int:pk>/', views.todo_detail, name='todo-detail'),
    
    # 🔥 ADD THIS LINE HERE:
    path('todos/<int:pk>/permanent/', views.permanent_delete, name='permanent-delete'),
    
    # Sharing logic (UPDATED to Board Sharing - removed <int:pk>)
    path('todos/share/', views.share_todo, name='share-todo'),
    
    # 🔥 ADD THIS LINE FOR COLLABORATORS:
    path('collaborators/', views.list_collaborators, name='list-collaborators'),
    
    # Requests
    path('requests/', views.list_requests, name='list-requests'),
    path('requests/<int:pk>/handle/', views.handle_request, name='handle-request'),
    
    # Firebase Google Login
    path('google-login/', views.FirebaseGoogleLoginView.as_view(), name='google_login'),

    # Delete Colloboration
    path('collaborators/<int:pk>/remove/', views.remove_collaborator, name='remove-collaborator'),

]

