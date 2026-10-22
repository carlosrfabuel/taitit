import { Link, isRouteErrorResponse, useRouteError } from 'react-router';

// Shown for unknown URLs and for errors thrown while rendering a route.
export function NotFoundPage() {
  const error = useRouteError();
  const notFound = !error || (isRouteErrorResponse(error) && error.status === 404);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-5xl font-extrabold text-ink">{notFound ? '404' : 'Error'}</p>
      <p className="text-muted">{notFound ? 'This page does not exist.' : 'An unexpected error occurred.'}</p>
      <Link to="/models" className="mt-2 font-semibold text-accent">
        Back to the panel
      </Link>
    </div>
  );
}
