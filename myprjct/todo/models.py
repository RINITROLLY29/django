from django.db import models
from django.contrib.auth.models import User

class Todo(models.Model):
    title = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_todos")
    # This allows multiple people to see the same task once the board is shared
    shared_with = models.ManyToManyField(User, blank=True, related_name="shared_todos")
    time_started = models.DateTimeField(null=True, blank=True)
    time_spent = models.IntegerField(default=0)
    progress = models.BooleanField(default=False)
    completed = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

# --- UPDATED MODEL FOR FULL BOARD SHARING ---
class TodoRequest(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_requests")
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_requests")
    # 'pending', 'accepted', 'declined'
    status = models.CharField(max_length=20, default='pending')
    is_notified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Board access request from {self.sender.username} to {self.receiver.username}"