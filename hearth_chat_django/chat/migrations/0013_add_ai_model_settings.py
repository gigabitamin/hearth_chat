# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0012_chat_imageurls'),
    ]

    operations = [
        migrations.AddField(
            model_name='usersettings',
            name='ai_provider',
            field=models.CharField(default='gemini', max_length=20, verbose_name='AI 제공자'),
        ),
        migrations.AddField(
            model_name='usersettings',
            name='gemini_model',
            field=models.CharField(default='gemini-1.5-flash', max_length=50, verbose_name='Gemini 모델'),
        ),
    ] 