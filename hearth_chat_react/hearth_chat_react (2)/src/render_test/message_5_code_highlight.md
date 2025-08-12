### 🔒 비밀번호 유효성 검사 함수

비밀번호는 다음 조건을 만족해야 합니다:

- 최소 8자 이상
- 대문자 포함
- 특수문자 포함

```javascript
function isValidPassword(pw) {
  const regex = /^(?=.*[A-Z])(?=.*[\W_]).{8,}$/;
  return regex.test(pw);
}
```

> 💡 **주의:** `regex`는 유저 입력에 따라 달라질 수 있습니다.
