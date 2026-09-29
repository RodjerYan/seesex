import { PageStub } from '../components/ui/PageStub';

/** TODO(S5): ввод TOTP-кода -> POST /api/auth/totp/verify (tmpToken). */
export default function TwoFactor() {
  return (
    <PageStub
      title="Двухфакторная проверка"
      description="Экран ввода TOTP-кода появится в S5."
    />
  );
}
