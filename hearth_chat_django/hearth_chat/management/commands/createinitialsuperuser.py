from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from dotenv import load_dotenv
import os

load_dotenv()

class Command(BaseCommand):
    help = 'Create or update initial superuser for Railway deploy'

    def handle(self, *args, **options):
        User = get_user_model()
        username = 'gigabitamin'
        email = 'gigabitamin@gmail.com'
        password = 'password'
        user, created = User.objects.get_or_create(username=username, defaults={'email': email})
        user.email = email
        user.is_superuser = True
        user.is_staff = True
        user.set_password(password)
        user.save()
        if created:
            self.stdout.write(f'Superuser {username} created.')
        else:
            self.stdout.write(f'Superuser {username} password updated.') 