/**
 * A menu of the landing page. `label` is a message id — the page translates it.
 * `#section` scrolls this page; `/path` opens another page (a menu that anyone, signed in or not,
 * may visit — e.g. the competitions).
 */
export type LandingLink = {
  href: `#${string}` | `/${string}`;
  label: string;
  /** Icon of a page menu (a name, since the nav is a client component and cannot be handed a component). */
  icon?: "trophy" | "radar";
};

export const isPageLink = (l: LandingLink) => l.href.startsWith("/");
