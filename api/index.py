from flask import Flask, render_template, request, send_file, jsonify
import os
from PIL import Image
import io
import base64
from werkzeug.utils import secure_filename
from rsa_stego import generate_rsa_keys, rsa_encrypt, rsa_decrypt, embed_message_into_image, extract_message_from_image

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = '/tmp'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/encrypt', methods=['POST'])
def encrypt():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400
    
    file = request.files['image']
    message = request.form.get('message', '')
    
    if not file or not message:
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        # Generate RSA keys
        public_key, private_key = generate_rsa_keys(1024)
        
        # Save original image
        img = Image.open(file)
        img_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(file.filename))
        img.save(img_path)
        
        # Encrypt message and embed in image
        encrypted_message = rsa_encrypt(message, public_key)
        output_path = embed_message_into_image(img_path, str(encrypted_message))
        
        # Convert output image to base64
        with open(output_path, 'rb') as img_file:
            img_data = base64.b64encode(img_file.read()).decode()
        
        # Clean up temporary files
        os.remove(img_path)
        os.remove(output_path)
        
        # Convert keys to base64 for download
        private_key_bytes = private_key[0].to_bytes(256, byteorder='big') + private_key[1].to_bytes(256, byteorder='big')
        private_key_b64 = base64.b64encode(private_key_bytes).decode()
        
        return jsonify({
            'success': True,
            'image': img_data,
            'private_key': private_key_b64
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/decrypt', methods=['POST'])
def decrypt():
    if 'image' not in request.files or 'private_key' not in request.files:
        return jsonify({'error': 'Missing required files'}), 400
    
    try:
        # Save and process image
        file = request.files['image']
        img_path = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(file.filename))
        file.save(img_path)
        
        # Process private key
        key_file = request.files['private_key']
        key_data = base64.b64decode(key_file.read())
        d = int.from_bytes(key_data[:256], byteorder='big')
        n = int.from_bytes(key_data[256:], byteorder='big')
        private_key = (d, n)
        
        # Extract and decrypt message
        extracted_message = extract_message_from_image(img_path)
        if extracted_message:
            decrypted_message = rsa_decrypt(int(extracted_message), private_key)
            
            # Clean up
            os.remove(img_path)
            
            return jsonify({
                'success': True,
                'message': decrypted_message
            })
        else:
            return jsonify({'error': 'No message found in image'}), 400
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)