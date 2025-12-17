from django.urls import path
from . import views

urlpatterns = [
    # API endpoints for CRUD operations
    path('todos/', views.todo_list, name='todo-list'),
    path('todos/<int:pk>/', views.todo_detail, name='todo-detail'),
    
    # Sharing logic
    path('todos/<int:pk>/share/', views.share_todo, name='share-todo'),
    
    # 🔥 ADD THESE TWO LINES BELOW:
    path('requests/', views.list_requests, name='list-requests'),
    path('requests/<int:pk>/handle/', views.handle_request, name='handle-request'),
    
    # Firebase Google Login
    path('google-login/', views.FirebaseGoogleLoginView.as_view(), name='google_login'),
]