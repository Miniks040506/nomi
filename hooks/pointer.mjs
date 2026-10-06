// Claude Code plugin adapter: a plugin install has no project file to carry the pointer line (tools/install.mjs writes it for
// project installs), so the same line is added to the session's context at start. Prints nothing else and never fails the session.
import { POINTER } from '../tools/install.mjs';
console.log(POINTER.replace(' <!-- nomi -->', ''));
