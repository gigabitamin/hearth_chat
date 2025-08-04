# Generated manually for adding ai_settings field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0011_auto_20250804_0000'),  # 이전 마이그레이션에 맞게 수정 필요
    ]

    operations = [
        migrations.AddField(
            model_name='usersettings',
            name='ai_settings',
            field=models.TextField(blank=True, null=True, verbose_name='AI 설정 (JSON)'),
        ),
    ] 