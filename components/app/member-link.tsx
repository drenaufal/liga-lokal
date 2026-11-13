import Link from "next/link";
import { isGuest } from "@/lib/auth/session";

/**
 * A link to a page that needs an account (a match console, a club profile…). A visitor without
 * one sees the same content as plain text instead of a link that would only bounce them to the
 * login page. Server component: it reads the request's session.
 */
export async function MemberLink({
  href,
  className,
  children,
  title,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  if (await isGuest()) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  );
}
