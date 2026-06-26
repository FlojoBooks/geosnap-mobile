const { spawn, exec } = require('child_process');
const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

console.log('=== Geosnap Mobile Ontwikkelserver ===');
console.log('1. Start lokale webserver...');

// Start http-server on port 8080
const server = spawn('npx', ['--yes', 'http-server', 'public', '-p', '8080'], { shell: true });

let serverReady = false;

server.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('Available on:') && !serverReady) {
    serverReady = true;
    const localIp = getLocalIP();
    const localUrl = `http://${localIp}:8080`;
    console.log(`\n✔ Lokale server actief op: ${localUrl}`);
    
    console.log('2. Beveiligde HTTPS tunnel opstarten via localtunnel...');
    
    // Start localtunnel to get secure URL (needed for camera/GPS on mobile)
    const lt = spawn('npx', ['--yes', 'localtunnel', '--port', '8080'], { shell: true });
    
    let ltReady = false;
    
    lt.stdout.on('data', (ltData) => {
      const ltOutput = ltData.toString();
      if (ltOutput.includes('url is:') && !ltReady) {
        ltReady = true;
        const secureUrl = ltOutput.split('url is:')[1].trim();
        console.log(`✔ Beveiligde tunnel actief op: ${secureUrl}`);
        console.log('\n3. QR-Code genereren...');
        
        // Generate QR code for the secure HTTPS URL
        exec(`npx -y qrcode-terminal "${secureUrl}"`, (qrErr, qrStdout) => {
          if (!qrErr) {
            console.log('\nScan deze QR-code met je telefoon (camera app) om direct te testen:');
            console.log(qrStdout);
            console.log(`Adres: ${secureUrl}`);
            console.log('Druk op Ctrl+C om de server te stoppen.\n');
          } else {
            console.log('Kon QR-code niet genereren:', qrErr);
          }
        });
      }
    });

    lt.stderr.on('data', (ltErr) => {
      // If localtunnel fails, fallback to local IP QR-code
      if (!ltReady) {
        ltReady = true;
        console.log('⚠ Localtunnel start mislukt. We gebruiken de lokale IP QR-code.');
        generateLocalIpQr(localUrl);
      }
    });
    
    // Fallback if localtunnel doesn't respond in 5 seconds
    setTimeout(() => {
      if (!ltReady) {
        ltReady = true;
        console.log('⚠ Localtunnel reageert niet. We gebruiken de lokale IP QR-code.');
        try { lt.kill(); } catch(e) {}
        generateLocalIpQr(localUrl);
      }
    }, 5000);
  }
});

function generateLocalIpQr(localUrl) {
  console.log('\n3. QR-Code genereren voor lokaal netwerk...');
  exec(`npx -y qrcode-terminal "${localUrl}"`, (qrErr, qrStdout) => {
    if (!qrErr) {
      console.log('\nScan deze QR-code met je telefoon om te testen (Let op: camera/GPS vereist mogelijk HTTPS):');
      console.log(qrStdout);
      console.log(`Adres: ${localUrl}`);
      console.log('\nTip: Als camera/GPS niet werkt op Android Chrome via HTTP, open dan op je telefoon:');
      console.log('chrome://flags/#unsafely-treat-insecure-origin-as-secure');
      console.log(`en voeg daar dit adres toe: ${localUrl} (en zet op Enabled).`);
      console.log('\nDruk op Ctrl+C om de server te stoppen.\n');
    }
  });
}

server.stderr.on('data', (data) => {
  console.error('Server Fout:', data.toString());
});

process.on('SIGINT', () => {
  console.log('\nServer wordt afgesloten...');
  server.kill();
  process.exit();
});
