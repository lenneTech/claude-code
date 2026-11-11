// lt-dev hooks module: the mod part of lt-dev, loaded through `modules` in hooks.json
// next to the settings hooks there. Claude Code calls `register` once per load.
import { registerPluginUpdates } from './plugin-updates.js'

export function register(on) {
  registerPluginUpdates(on)
}
