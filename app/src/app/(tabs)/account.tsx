import { NavLink } from '@/components/NavLink';
import { Placeholder } from '@/components/Placeholder';

export default function AccountScreen() {
  return (
    <Placeholder title="Cuenta" note="Perfil, cerrar sesión y eliminar cuenta (Días 4 y 20).">
      <NavLink href="/sign-in" label="Iniciar sesión" />
    </Placeholder>
  );
}
