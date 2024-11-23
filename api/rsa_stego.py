from PIL import Image
import binascii
from tqdm import tqdm  # Thêm thư viện tqdm

# Hàm sinh số nguyên tố và tạo khóa RSA (256 bit)
class SimpleRandom:
    def __init__(self, seed):
        self.seed = seed

    def next(self):
        self.seed = (self.seed * 1103515245 + 12345) % (2**31)
        return self.seed

def miller_rabin(n, k=40, random_gen=None):
    if n <= 1:
        return False
    if n <= 3:
        return True
    if n % 2 == 0:
        return False

    r, s = 0, n - 1
    while s % 2 == 0:
        r += 1
        s //= 2

    for _ in range(k):
        a = random_gen.next() % (n - 2) + 2  # Tạo số ngẫu nhiên từ 2 đến n-2
        x = pow(a, s, n)
        if x == 1 or x == n - 1:
            continue
        for _ in range(r - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True

def generate_large_prime(bits, random_gen):
    while True:
        p = (random_gen.next() % (1 << bits)) | (1 << (bits - 1)) | 1  # Đảm bảo p là số lẻ và có độ dài đúng
        if miller_rabin(p, random_gen=random_gen):
            return p

def generate_rsa_keys(bits):
    seed = 42  # Hạt giống cho số ngẫu nhiên
    random_gen = SimpleRandom(seed)
    p = generate_large_prime(bits // 2, random_gen)
    q = generate_large_prime(bits // 2, random_gen)
    n = p * q
    phi = (p - 1) * (q - 1)
    e = 65537  # Số nguyên tố công khai
    d = pow(e, -1, phi)
    return (e, n), (d, n)

# Mã hóa
def rsa_encrypt(message, public_key):
    e, n = public_key
    message_int = int.from_bytes(message.encode(), 'big')
    cipher_int = pow(message_int, e, n)
    return cipher_int

# Giải mã
def rsa_decrypt(cipher_int, private_key):
    d, n = private_key
    message_int = pow(cipher_int, d, n)
    message = message_int.to_bytes((message_int.bit_length() + 7) // 8, 'big').decode()
    return message

# Nhúng tin nhắn vào hình ảnh
def embed_message_into_image(image_path, message):
    image = Image.open(image_path)
    binary_message = ''.join(format(ord(i), '08b') for i in message)
    binary_message += '1111111111111110'  # Thêm dấu kết thúc tin nhắn

    width, height = image.size
    pixels = image.load()
    data_index = 0

    # Sử dụng tqdm để tạo thanh tiến trình cho vòng lặp
    for y in tqdm(range(height), desc="Đang xử lý các dòng", unit="dòng"):
        for x in range(width):
            if data_index < len(binary_message):
                pixel = list(pixels[x, y])
                for i in range(3):  # Thay đổi từng kênh màu RGB
                    if data_index < len(binary_message):
                        pixel[i] = pixel[i] & ~1 | int(binary_message[data_index])
                        data_index += 1
                pixels[x, y] = tuple(pixel)
            else:
                break
    print()
    output_image_path = 'output_image_with_message.png'
    image.save(output_image_path)
    return output_image_path

# Giải mã tin nhắn từ hình ảnh
def extract_message_from_image(image_path):
    image = Image.open(image_path)
    width, height = image.size
    pixels = image.load()
    
    binary_message = ''
    for y in tqdm(range(height), desc="Đang xử lý các dòng", unit="dòng"):
        for x in range(width):
            pixel = pixels[x, y]
            for i in range(3):
                binary_message += str(pixel[i] & 1)

                if binary_message.endswith('1111111111111110'):
                    binary_message = binary_message[:-16]
                    message = ''.join(chr(int(binary_message[i:i+8], 2)) for i in range(0, len(binary_message), 8))
                    return message
    return None

# Lưu khóa RSA
def save_rsa_keys(private_key, public_key):
    with open("private_key.pem", "wb") as f:
        f.write(private_key[0].to_bytes(256, byteorder='big') + private_key[1].to_bytes(256, byteorder='big'))
    with open("public_key.pem", "wb") as f:
        f.write(public_key[0].to_bytes(256, byteorder='big') + public_key[1].to_bytes(256, byteorder='big'))

# Tải khóa RSA
def load_rsa_key(file_path, is_private=True):
    with open(file_path, "rb") as f:
        key_data = f.read()
        e = int.from_bytes(key_data[:256], byteorder='big')
        n = int.from_bytes(key_data[256:], byteorder='big')
        if is_private:
            return (e, n)
        else:
            return (e, n)
