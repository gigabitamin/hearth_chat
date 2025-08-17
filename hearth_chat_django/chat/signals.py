from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import UserSettings

@receiver(post_save, sender=User)
def create_user_settings(sender, instance, created, **kwargs):
    """User가 생성될 때 자동으로 UserSettings 생성"""
    if created:
        UserSettings.objects.create(user=instance)
        print(f"[SIGNAL] UserSettings created for user: {instance.username}")

@receiver(post_save, sender=User)
def save_user_settings(sender, instance, **kwargs):
    """User가 저장될 때 UserSettings도 함께 저장"""
    try:
        instance.usersettings.save()
    except UserSettings.DoesNotExist:
        # UserSettings가 없는 경우 생성
        UserSettings.objects.create(user=instance)
        print(f"[SIGNAL] UserSettings created for existing user: {instance.username}") 