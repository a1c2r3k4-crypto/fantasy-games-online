import readline from 'node:readline';
import bcrypt from 'bcryptjs';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
rl._writeToOutput = function (value) { if (!muted) this.output.write(value); };
process.stdout.write('Escribe la contraseña privada (no se mostrará): ');
muted = true;
rl.question('', async password => {
  rl.close();
  if (!password || password.length < 10) {
    console.error('\nUsa una contraseña de al menos 10 caracteres.');
    process.exitCode = 1;
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  console.log('\nCopia este hash en DEDICATION_PASSWORD_HASH, dentro de Render > Environment:');
  console.log(hash);
  console.log('\nNo subas la contraseña original a GitHub.');
});
