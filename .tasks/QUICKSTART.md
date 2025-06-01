# 🚀 Scopecraft Quick Start Guide

Welcome to Scopecraft Command! This guide will help you get started with managing your tasks.

## 📋 Basic Commands

### Creating Tasks
```bash
# Create a new feature task
sc create --type feature --title "Add user authentication"

# Create a bug report
sc create --type bug --title "Fix login error" --priority "🔼 High"

# Create from a template
sc create --template feature --title "New Feature"
```

### Viewing Tasks
```bash
# List all tasks
sc list

# List tasks by status
sc list --status "🔵 In Progress"

# Get details of a specific task
sc get TASK-001
```

### Updating Tasks
```bash
# Update task status
sc update TASK-001 --status "🔵 In Progress"

# Assign a task
sc update TASK-001 --assignee "john.doe"

# Mark task as complete
sc update TASK-001 --status "🟢 Done"
```

## 📁 Task Types

Scopecraft supports 6 task types:
- **🌟 Feature**: New functionality or enhancements
- **🐞 Bug**: Issues that need fixing
- **🧹 Chore**: Maintenance and housekeeping tasks
- **📖 Documentation**: Documentation updates
- **🧪 Test**: Test-related tasks
- **💡 Spike/Research**: Investigation and research tasks

## 🎯 Workflow Tips

1. **Start with phases**: Organize your work into phases (releases, sprints, etc.)
   ```bash
   sc phase-create --id "sprint-1" --name "Sprint 1"
   ```

2. **Use features for complex work**: Group related tasks together
   ```bash
   sc feature create --name "UserAuth" --title "User Authentication System" --phase "sprint-1"
   ```

3. **Track progress**: See what's currently in progress
   ```bash
   sc current-task
   ```

4. **Find next task**: Get recommendations on what to work on next
   ```bash
   sc next-task
   ```

## 🛠️ Customization

### Templates
Templates are stored in `.tasks/.templates/`. You can customize them to match your workflow:
- Edit the YAML frontmatter to add custom fields
- Modify the markdown structure to fit your needs
- Templates support all standard MDTM fields

## 📚 Learn More

- Run `sc --help` for all available commands
- Visit https://github.com/scopecraft/scopecraft-command for documentation
- Use `sc list-templates` to see available task templates

## 💡 Pro Tips

- Use tags to categorize tasks: `--tags "backend,api"`
- Set dependencies between tasks: `--depends "TASK-001,TASK-002"`
- Filter tasks by multiple criteria: `sc list --status "🟡 To Do" --type "🌟 Feature"`
- Export tasks as JSON: `sc list --format json > tasks.json`

Happy task management! 🎉
