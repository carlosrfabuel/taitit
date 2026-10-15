import { NavLink } from '@/components/NavLink';
import { Placeholder } from '@/components/Placeholder';

export default function SignInScreen() {
  return (
    <Placeholder title="Iniciar sesión" note="Email, Google y Apple (Día 4).">
      <NavLink href="/sign-up" label="Crear cuenta" />
      <NavLink href="/forgot-password" label="He olvidado mi contraseña" />
    </Placeholder>
  );
}
