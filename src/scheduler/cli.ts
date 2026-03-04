// ============================================================
// 🦀 Krab — Scheduler CLI Commands
// ============================================================
import { Command } from 'commander';
import { CronScheduler } from './cron.js';
import { BuiltInTasks } from './built-in-tasks.js';
import { logger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

export function createSchedulerCommands(): Command {
  const schedulerCmd = new Command('scheduler')
    .description('Manage scheduled tasks and cron jobs');

  // Initialize scheduler and built-in tasks
  const scheduler = new CronScheduler();
  const builtInTasks = new BuiltInTasks(scheduler);

  // Start scheduler
  schedulerCmd
    .command('start')
    .description('Start the task scheduler')
    .action(async () => {
      try {
        logger.info('Starting Krab scheduler...');

        // Initialize built-in tasks
        await builtInTasks.initializeBuiltInTasks();

        // Start the scheduler
        scheduler.start();

        logger.info('✅ Scheduler started successfully');
        console.log('🕒 Krab scheduler is now running');
        console.log('Use Ctrl+C to stop');

        // Keep the process running
        process.on('SIGINT', () => {
          console.log('\n🛑 Stopping scheduler...');
          scheduler.stop();
          process.exit(0);
        });

        process.on('SIGTERM', () => {
          console.log('\n🛑 Stopping scheduler...');
          scheduler.stop();
          process.exit(0);
        });

      } catch (error) {
        logger.error('Failed to start scheduler:', error);
        console.error('❌ Failed to start scheduler:', (error as Error).message);
        process.exit(1);
      }
    });

  // Stop scheduler
  schedulerCmd
    .command('stop')
    .description('Stop the task scheduler')
    .action(() => {
      try {
        scheduler.stop();
        logger.info('Scheduler stopped');
        console.log('✅ Scheduler stopped');
      } catch (error) {
        logger.error('Failed to stop scheduler:', error);
        console.error('❌ Failed to stop scheduler:', (error as Error).message);
      }
    });

  // List tasks
  schedulerCmd
    .command('list')
    .description('List all scheduled tasks')
    .option('-s, --status <status>', 'Filter by status (enabled/disabled)', 'all')
    .option('-t, --tag <tag>', 'Filter by tag')
    .action((options) => {
      try {
        let tasks = scheduler.getAllTasks();

        // Filter by status
        if (options.status === 'enabled') {
          tasks = tasks.filter(t => t.enabled);
        } else if (options.status === 'disabled') {
          tasks = tasks.filter(t => !t.enabled);
        }

        // Filter by tag
        if (options.tag) {
          tasks = tasks.filter(t => t.tags.includes(options.tag));
        }

        if (tasks.length === 0) {
          console.log('📋 No scheduled tasks found');
          return;
        }

        console.log(`📋 Scheduled Tasks (${tasks.length}):`);
        console.log('─'.repeat(100));

        tasks.forEach(task => {
          const status = task.enabled ? '✅' : '❌';
          const lastRun = task.lastRun ? task.lastRun.toLocaleString() : 'Never';
          const nextRun = task.nextRun ? task.nextRun.toLocaleString() : 'N/A';

          console.log(`${status} ${task.name} (${task.id})`);
          console.log(`   📝 ${task.description || 'No description'}`);
          console.log(`   ⏰ Schedule: ${task.cronExpression}`);
          console.log(`   🏷️  Tags: ${task.tags.join(', ') || 'None'}`);
          console.log(`   🎯 Priority: ${task.priority}`);
          console.log(`   📅 Last Run: ${lastRun}`);
          console.log(`   ⏭️  Next Run: ${nextRun}`);

          if (task.lastResult) {
            const resultStatus = task.lastResult.success ? '✅ Success' : '❌ Failed';
            console.log(`   📊 Last Result: ${resultStatus} (${task.lastResult.executionTime}ms)`);
            if (task.lastResult.error) {
              console.log(`   ⚠️  Error: ${task.lastResult.error}`);
            }
          }

          console.log('');
        });

      } catch (error) {
        logger.error('Failed to list tasks:', error);
        console.error('❌ Failed to list tasks:', (error as Error).message);
      }
    });

  // Add task
  schedulerCmd
    .command('add <name>')
    .description('Add a new scheduled task')
    .option('-d, --description <desc>', 'Task description')
    .option('-s, --schedule <cron>', 'Cron schedule expression', '*/5 * * * *')
    .option('-c, --command <cmd>', 'Command to execute', 'echo')
    .option('-a, --args <args>', 'Command arguments (comma-separated)')
    .option('-t, --tags <tags>', 'Task tags (comma-separated)')
    .option('-p, --priority <priority>', 'Task priority', 'medium')
    .option('--timeout <seconds>', 'Task timeout in seconds', '300')
    .action((name, options) => {
      try {
        const args = options.args ? options.args.split(',').map((a: string) => a.trim()) : undefined;
        const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [];

        const taskId = scheduler.addTask({
          name,
          description: options.description,
          cronExpression: options.schedule,
          command: options.command,
          args,
          enabled: true,
          tags,
          priority: options.priority as 'low' | 'medium' | 'high' | 'critical',
          timeout: parseInt(options.timeout),
          retries: 0,
          maxRetries: 3
        });

        logger.info(`Task added: ${name} (${taskId})`);
        console.log(`✅ Task added: ${name} (${taskId})`);

      } catch (error) {
        logger.error('Failed to add task:', error);
        console.error('❌ Failed to add task:', (error as Error).message);
      }
    });

  // Remove task
  schedulerCmd
    .command('remove <taskId>')
    .description('Remove a scheduled task')
    .action((taskId) => {
      try {
        const removed = scheduler.removeTask(taskId);

        if (removed) {
          logger.info(`Task removed: ${taskId}`);
          console.log(`✅ Task removed: ${taskId}`);
        } else {
          console.log(`❌ Task not found: ${taskId}`);
        }

      } catch (error) {
        logger.error('Failed to remove task:', error);
        console.error('❌ Failed to remove task:', (error as Error).message);
      }
    });

  // Enable/disable task
  schedulerCmd
    .command('enable <taskId>')
    .description('Enable a scheduled task')
    .action((taskId) => {
      try {
        const enabled = scheduler.enableTask(taskId);

        if (enabled) {
          logger.info(`Task enabled: ${taskId}`);
          console.log(`✅ Task enabled: ${taskId}`);
        } else {
          console.log(`❌ Task not found: ${taskId}`);
        }

      } catch (error) {
        logger.error('Failed to enable task:', error);
        console.error('❌ Failed to enable task:', (error as Error).message);
      }
    });

  schedulerCmd
    .command('disable <taskId>')
    .description('Disable a scheduled task')
    .action((taskId) => {
      try {
        const disabled = scheduler.disableTask(taskId);

        if (disabled) {
          logger.info(`Task disabled: ${taskId}`);
          console.log(`✅ Task disabled: ${taskId}`);
        } else {
          console.log(`❌ Task not found: ${taskId}`);
        }

      } catch (error) {
        logger.error('Failed to disable task:', error);
        console.error('❌ Failed to disable task:', (error as Error).message);
      }
    });

  // Show task details
  schedulerCmd
    .command('show <taskId>')
    .description('Show detailed information about a task')
    .action((taskId) => {
      try {
        const task = scheduler.getTask(taskId);

        if (!task) {
          console.log(`❌ Task not found: ${taskId}`);
          return;
        }

        console.log(`📋 Task Details: ${task.name}`);
        console.log('─'.repeat(50));
        console.log(`ID: ${task.id}`);
        console.log(`Name: ${task.name}`);
        console.log(`Description: ${task.description || 'No description'}`);
        console.log(`Schedule: ${task.cronExpression}`);
        console.log(`Command: ${task.command}`);
        console.log(`Args: ${task.args ? JSON.stringify(task.args) : 'None'}`);
        console.log(`Enabled: ${task.enabled ? 'Yes' : 'No'}`);
        console.log(`Tags: ${task.tags.join(', ') || 'None'}`);
        console.log(`Priority: ${task.priority}`);
        console.log(`Timeout: ${task.timeout}s`);
        console.log(`Retries: ${task.retries}/${task.maxRetries}`);
        console.log(`Created: ${task.createdAt.toLocaleString()}`);
        console.log(`Updated: ${task.updatedAt.toLocaleString()}`);

        if (task.lastRun) {
          console.log(`Last Run: ${task.lastRun.toLocaleString()}`);
        }

        if (task.nextRun) {
          console.log(`Next Run: ${task.nextRun.toLocaleString()}`);
        }

        if (task.lastResult) {
          console.log(`Last Result: ${task.lastResult.success ? 'Success' : 'Failed'}`);
          console.log(`Execution Time: ${task.lastResult.executionTime}ms`);
          if (task.lastResult.output) {
            console.log(`Output: ${task.lastResult.output.substring(0, 200)}${task.lastResult.output.length > 200 ? '...' : ''}`);
          }
          if (task.lastResult.error) {
            console.log(`Error: ${task.lastResult.error}`);
          }
        }

      } catch (error) {
        logger.error('Failed to show task:', error);
        console.error('❌ Failed to show task:', (error as Error).message);
      }
    });

  // Built-in tasks management
  schedulerCmd
    .command('builtin')
    .description('Manage built-in scheduled tasks')
    .addCommand(
      new Command('init')
        .description('Initialize all built-in tasks')
        .action(async () => {
          try {
            await builtInTasks.initializeBuiltInTasks();
            console.log('✅ Built-in tasks initialized');
          } catch (error) {
            console.error('❌ Failed to initialize built-in tasks:', (error as Error).message);
          }
        })
    )
    .addCommand(
      new Command('add-news <name> <url>')
        .description('Add a custom news source')
        .option('-s, --schedule <cron>', 'Schedule expression', '0 */4 * * *')
        .action((name, url, options) => {
          try {
            builtInTasks.addCustomNewsSource(name, url, options.schedule);
            console.log(`✅ Added news source: ${name}`);
          } catch (error) {
            console.error('❌ Failed to add news source:', (error as Error).message);
          }
        })
    )
    .addCommand(
      new Command('add-monitor <metric> <threshold>')
        .description('Add a monitoring alert')
        .option('-s, --schedule <cron>', 'Schedule expression', '*/5 * * * *')
        .action((metric, threshold, options) => {
          try {
            builtInTasks.addMonitoringAlert(metric, parseFloat(threshold), options.schedule);
            console.log(`✅ Added monitoring alert for ${metric}`);
          } catch (error) {
            console.error('❌ Failed to add monitoring alert:', (error as Error).message);
          }
        })
    )
    .addCommand(
      new Command('add-maintenance')
        .description('Add database maintenance task')
        .option('-s, --schedule <cron>', 'Schedule expression', '0 4 * * 0')
        .action((options) => {
          try {
            builtInTasks.addDatabaseMaintenance(options.schedule);
            console.log('✅ Added database maintenance task');
          } catch (error) {
            console.error('❌ Failed to add maintenance task:', (error as Error).message);
          }
        })
    )
    .addCommand(
      new Command('templates')
        .description('Show available task templates')
        .action(() => {
          const templates = builtInTasks.getTaskTemplates();
          console.log('📋 Available Task Templates:');
          console.log('─'.repeat(60));

          templates.forEach((template, index) => {
            console.log(`${index + 1}. ${template.name}`);
            console.log(`   ${template.description}`);
            console.log(`   Schedule: ${template.template.cronExpression}`);
            console.log(`   Priority: ${template.template.priority}`);
            console.log('');
          });
        })
    );

  // Statistics
  schedulerCmd
    .command('stats')
    .description('Show scheduler statistics')
    .action(() => {
      try {
        const stats = scheduler.getStats();

        console.log('📊 Scheduler Statistics:');
        console.log('─'.repeat(40));
        console.log(`Total Tasks: ${stats.totalTasks}`);
        console.log(`Enabled Tasks: ${stats.enabledTasks}`);
        console.log(`Running Tasks: ${stats.runningTasks}`);
        console.log(`Completed Runs: ${stats.completedRuns}`);
        console.log(`Failed Runs: ${stats.failedRuns}`);
        console.log(`Average Execution Time: ${Math.round(stats.averageExecutionTime)}ms`);

        if (stats.totalTasks > 0) {
          const successRate = stats.completedRuns > 0
            ? Math.round(((stats.completedRuns - stats.failedRuns) / stats.completedRuns) * 100)
            : 0;
          console.log(`Success Rate: ${successRate}%`);
        }

      } catch (error) {
        logger.error('Failed to get statistics:', error);
        console.error('❌ Failed to get statistics:', (error as Error).message);
      }
    });

  // Import/export
  schedulerCmd
    .command('export <file>')
    .description('Export scheduled tasks to a file')
    .action((file) => {
      try {
        const tasks = scheduler.getAllTasks();
        const exportData = {
          exportedAt: new Date().toISOString(),
          tasks
        };

        fs.writeFileSync(file, JSON.stringify(exportData, null, 2));
        console.log(`✅ Tasks exported to ${file}`);

      } catch (error) {
        logger.error('Failed to export tasks:', error);
        console.error('❌ Failed to export tasks:', (error as Error).message);
      }
    });

  schedulerCmd
    .command('import <file>')
    .description('Import scheduled tasks from a file')
    .action((file) => {
      try {
        if (!fs.existsSync(file)) {
          console.error(`❌ File not found: ${file}`);
          return;
        }

        const importData = JSON.parse(fs.readFileSync(file, 'utf8'));
        let importedCount = 0;

        if (importData.tasks) {
          for (const taskData of importData.tasks) {
            try {
              // Remove id and timestamps to create new task
              const { id, createdAt, updatedAt, lastRun, nextRun, ...taskWithoutIds } = taskData;
              scheduler.addTask(taskWithoutIds);
              importedCount++;
            } catch (error) {
              console.warn(`⚠️ Failed to import task ${taskData.name}:`, error);
            }
          }
        }

        console.log(`✅ Imported ${importedCount} tasks from ${file}`);

      } catch (error) {
        logger.error('Failed to import tasks:', error);
        console.error('❌ Failed to import tasks:', (error as Error).message);
      }
    });

  return schedulerCmd;
}

// Export for use in main CLI
