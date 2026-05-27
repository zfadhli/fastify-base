import { cac } from 'cac';
import { scaffold } from './commands/scaffold';

const cli = cac('gen');

cli.command('scaffold [name]', 'Scaffold a new CRUD resource')
  .action((name) => scaffold(name));

cli.help();
cli.parse();
