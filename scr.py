from django.core.management.utils import get_random_secret_key; 
print(get_random_secret_key())

# "n@xq7_#jecxz%h$o&9^r1h$trg-s(+6%7@wczzmov#swhcac7#"

# fly secrets set DJANGO_SECRET_KEY="n@xq7_#jecxz%h$o&9^r1h$trg-s(+6%7@wczzmov#swhcac7#" -a hearth-chat