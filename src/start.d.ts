// TanStack Start augments `@tanstack/router-core`'s route options with the
// `server: { handlers }` block that server routes are declared through. The
// augmentation ships as a type-only re-export inside `@tanstack/react-start`, so
// it only applies once that module is part of the program — and route files
// import `createFileRoute` from `@tanstack/react-router`, which does not pull it
// in. This reference is what makes server routes type-check.
import type {} from '@tanstack/react-start';
