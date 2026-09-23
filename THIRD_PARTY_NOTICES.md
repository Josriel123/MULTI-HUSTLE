# Third-party notices

The licence texts of every package Multi-Hustle is built on, the Outfit typeface
and the icon are in [`public/third-party-notices.txt`](public/third-party-notices.txt),
which the site serves at `/third-party-notices.txt` and links from its Licenses
page (`/legal/licenses`).

It is generated from the installed production dependency tree
(`npm ls --omit=dev --all`) by `npm run notices`; run it when dependencies
change (`docs/security-program.md`, "Change management").
