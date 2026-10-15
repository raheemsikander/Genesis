# Setting Up the Apollo Plugin

The project uses [apollo](https://github.com/Conrad-Labs/olympus) (from the `olympus` marketplace), a Claude Code plugin that provides workflow skills for feature development, bug fixes, PR creation, and more.

If you use Claude Code, install the plugin:

Run the commands inside claude terminal

```bash
# Add the Conrad Labs marketplace (one time per machine)
/plugin marketplace add Conrad-Labs/olympus

# Install the plugin
/plugin install apollo@olympus
```

Then run the setup skill once per project:

```bash
/apollo:cl-init
```

This creates `.claude/apollo.json` with your project's settings. Commit this file so your team shares the same config.

**Requirements:** apollo depends on the claude official super powers plugin — install it first if you haven't already. If using Notion as your ticket provider, [Notion MCP](https://github.com/anthropics/claude-code-plugins) must also be configured.

> **Note:** This step is only relevant if you use Claude Code as your AI coding assistant. The app runs fully without it.
