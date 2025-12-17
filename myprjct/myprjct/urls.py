"""
URL configuration for myprjct project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.views.generic.base import RedirectView
from todo.views import todo_list,todo_detail
from rest_framework.authtoken.views import obtain_auth_token
# 🔥 NEW: Import the class-based view for Google Login
from todo.views import FirebaseGoogleLoginView

urlpatterns = [
    path('', RedirectView.as_view(url='/api/todos/', permanent=False)),
    path('admin/', admin.site.urls),
    path('api/', include('todo.urls')),
    path('api/todos/', todo_list),
    path('api/todos/<int:pk>/', todo_detail),
    path("api/login/", obtain_auth_token),  # matches frontend request
    # 🔥 NEW: Google Login Endpoint (Token Exchange)
    # This is the endpoint the React frontend will POST the Firebase ID Token to.
    path('api/google-login/', FirebaseGoogleLoginView.as_view(), name='google_login'),

]
