// Simple Random Number Generator
class SimpleRandom {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 1103515245 + 12345) % Math.pow(2, 31);
    return this.seed;
  }
}

// Miller-Rabin Primality Test
function millerRabin(n, k = 40, randomGen) {
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0) return false;

  let r = 0;
  let s = n - 1;
  while (s % 2 === 0) {
    r += 1;
    s = Math.floor(s / 2);
  }

  for (let i = 0; i < k; i++) {
    const a = randomGen.next() % (n - 2) + 2;
    let x = modPow(a, s, n);
    if (x === 1 || x === n - 1) continue;

    let continueLoop = false;
    for (let j = 0; j < r - 1; j++) {
      x = modPow(x, 2, n);
      if (x === n - 1) {
        continueLoop = true;
        break;
      }
    }
    if (continueLoop) continue;
    return false;
  }
  return true;
}

// Modular exponentiation
function modPow(base, exponent, modulus) {
  if (modulus === 1) return 0;
  let result = 1;
  base = base % modulus;
  while (exponent > 0) {
    if (exponent % 2 === 1) {
      result = (result * base) % modulus;
    }
    base = (base * base) % modulus;
    exponent = Math.floor(exponent / 2);
  }
  return result;
}

// Generate large prime number
function generateLargePrime(bits, randomGen) {
  while (true) {
    const p = (randomGen.next() % (1n << BigInt(bits))) | (1n << BigInt(bits - 1)) | 1n;
    if (millerRabin(Number(p), 40, randomGen)) {
      return p;
    }
  }
}

// Generate RSA keys
function generateRsaKeys(bits) {
  const seed = 42;
  const randomGen = new SimpleRandom(seed);
  const p = generateLargePrime(Math.floor(bits / 2), randomGen);
  const q = generateLargePrime(Math.floor(bits / 2), randomGen);
  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  const e = 65537n;
  
  // Calculate modular multiplicative inverse
  function modInverse(a, m) {
    let m0 = m;
    let x0 = 0n;
    let x1 = 1n;
    
    if (m === 1n) return 0n;
    
    while (a > 1n) {
      const q = a / m;
      let t = m;
      m = a % m;
      a = t;
      t = x0;
      x0 = x1 - q * x0;
      x1 = t;
    }
    
    if (x1 < 0n) x1 += m0;
    return x1;
  }
  
  const d = modInverse(e, phi);
  return [[e, n], [d, n]];
}

// RSA encryption
function rsaEncrypt(message, publicKey) {
  const [e, n] = publicKey;
  const messageInt = BigInt('0x' + Buffer.from(message).toString('hex'));
  const cipherInt = modPow(messageInt, e, n);
  return cipherInt.toString();
}

// RSA decryption
function rsaDecrypt(cipherInt, privateKey) {
  const [d, n] = privateKey;
  const messageInt = modPow(BigInt(cipherInt), d, n);
  const hex = messageInt.toString(16);
  const bytes = Buffer.from(hex, 'hex');
  return bytes.toString();
}

// Embed message into image
async function embedMessageIntoImage(imageData, message) {
  const binary = message.split('').map(char => 
    char.charCodeAt(0).toString(2).padStart(8, '0')
  ).join('') + '1111111111111110';
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  return new Promise((resolve) => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let dataIndex = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        for (let j = 0; j < 3; j++) {
          if (dataIndex < binary.length) {
            data[i + j] = (data[i + j] & ~1) | parseInt(binary[dataIndex]);
            dataIndex++;
          }
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imageData;
  });
}

// Extract message from image
async function extractMessageFromImage(imageData) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  return new Promise((resolve) => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let binaryMessage = '';
      
      for (let i = 0; i < data.length; i += 4) {
        for (let j = 0; j < 3; j++) {
          binaryMessage += (data[i + j] & 1).toString();
          
          if (binaryMessage.endsWith('1111111111111110')) {
            binaryMessage = binaryMessage.slice(0, -16);
            const message = [];
            for (let k = 0; k < binaryMessage.length; k += 8) {
              message.push(String.fromCharCode(parseInt(binaryMessage.slice(k, k + 8), 2)));
            }
            resolve(message.join(''));
            return;
          }
        }
      }
      resolve(null);
    };
    img.src = imageData;
  });
}

// Save RSA keys
function saveRsaKeys(privateKey, publicKey) {
  const privateKeyStr = JSON.stringify(privateKey.map(n => n.toString()));
  const publicKeyStr = JSON.stringify(publicKey.map(n => n.toString()));
  
  // In a browser environment, you might want to use localStorage
  localStorage.setItem('private_key', privateKeyStr);
  localStorage.setItem('public_key', publicKeyStr);
  
  return {
    privateKeyPath: 'private_key',
    publicKeyPath: 'public_key'
  };
}

// Load RSA key
function loadRsaKey(keyData, isPrivate = true) {
  const [e, n] = JSON.parse(keyData).map(n => BigInt(n));
  return [e, n];
}

// Example usage in a browser environment:
async function main() {
  const form = document.createElement('form');
  form.innerHTML = `
    <div>
      <label>
        <input type="radio" name="action" value="encrypt" checked> Encrypt
      </label>
      <label>
        <input type="radio" name="action" value="decrypt"> Decrypt
      </label>
    </div>
    <div>
      <input type="file" accept="image/*" id="imageInput">
    </div>
    <div id="messageInput" style="display: none">
      <textarea placeholder="Enter message to encrypt"></textarea>
    </div>
    <button type="submit">Process</button>
    <div id="output"></div>
  `;

  document.body.appendChild(form);

  const messageInput = form.querySelector('#messageInput');
  form.querySelectorAll('input[name="action"]').forEach(radio => {
    radio.addEventListener('change', () => {
      messageInput.style.display = radio.value === 'encrypt' ? 'block' : 'none';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = form.querySelector('input[name="action"]:checked').value;
    const imageFile = form.querySelector('#imageInput').files[0];
    const output = form.querySelector('#output');

    if (!imageFile) {
      output.textContent = 'Please select an image file';
      return;
    }

    const imageData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(imageFile);
    });

    if (action === 'encrypt') {
      const message = form.querySelector('textarea').value;
      if (!message) {
        output.textContent = 'Please enter a message to encrypt';
        return;
      }

      const [publicKey, privateKey] = generateRsaKeys(1024);
      const encrypted = rsaEncrypt(message, publicKey);
      const { privateKeyPath, publicKeyPath } = saveRsaKeys(privateKey, publicKey);
      
      const encodedImage = await embedMessageIntoImage(imageData, encrypted);
      
      output.innerHTML = `
        <p>Message encrypted and embedded in image.</p>
        <p>Private key saved as: ${privateKeyPath}</p>
        <p>Public key saved as: ${publicKeyPath}</p>
        <img src="${encodedImage}" style="max-width: 500px">
      `;
    } else {
      const privateKeyData = localStorage.getItem('private_key');
      if (!privateKeyData) {
        output.textContent = 'Private key not found';
        return;
      }

      const privateKey = loadRsaKey(privateKeyData, true);
      const extracted = await extractMessageFromImage(imageData);
      
      if (extracted) {
        try {
          const decrypted = rsaDecrypt(extracted, privateKey);
          output.textContent = `Decrypted message: ${decrypted}`;
        } catch (error) {
          output.textContent = `Error decrypting message: ${error.message}`;
        }
      } else {
        output.textContent = 'No hidden message found in image';
      }
    }
  });
}