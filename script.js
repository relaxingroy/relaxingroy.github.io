const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Penyesuaian Ukuran Responsif
function resizeCanvas() {
    canvas.width = window.innerWidth > 480 ? 320 : window.innerWidth;
    canvas.height = window.innerHeight > 640 ? 480 : window.innerHeight;
}
resizeCanvas();

// Variabel Fisika
let frames = 0;
const gravity = 0.25;

const bird = {
    x: 50,
    y: canvas.height / 2,
    w: 25,
    h: 25,
    velocity: 0,
    jump: 4.5,
    
    draw: function() {
        ctx.fillStyle = "#f2e007";
        ctx.fillRect(this.x, this.y, this.w, this.h);
        // Border burung agar lebih jelas
        ctx.strokeStyle = "#000";
        ctx.strokeRect(this.x, this.y, this.w, this.h);
    },
    
    update: function() {
        this.velocity += gravity;
        this.y += this.velocity;

        // Batas bawah (Tanah)
        if (this.y + this.h >= canvas.height) {
            this.y = canvas.height - this.h;
            resetGame();
        }
        // Batas atas (Langit)
        if (this.y <= 0) {
            this.y = 0;
            this.velocity = 0;
        }
    },
    
    flap: function() {
        this.velocity = -this.jump;
    }
};

const pipes = {
    position: [],
    gap: 120, // Celah lebih lebar agar santai di HP
    width: 50,
    
    draw: function() {
        ctx.fillStyle = "#2ecc71";
        for(let i = 0; i < this.position.length; i++) {
            let p = this.position[i];
            // Pipa Atas
            ctx.fillRect(p.x, 0, this.width, p.y);
            // Pipa Bawah
            ctx.fillRect(p.x, p.y + this.gap, this.width, canvas.height);
        }
    },
    
    update: function() {
        if(frames % 90 === 0) {
            this.position.push({
                x: canvas.width,
                y: Math.floor(Math.random() * (canvas.height - this.gap - 100)) + 50
            });
        }
        for(let i = 0; i < this.position.length; i++) {
            let p = this.position[i];
            p.x -= 2.5; // Kecepatan gerak pipa

            // Deteksi Tabrakan (AABB)
            if(bird.x + bird.w > p.x && bird.x < p.x + this.width &&
              (bird.y < p.y || bird.y + bird.h > p.y + this.gap)) {
                resetGame();
            }

            if(p.x + this.width <= 0) this.position.shift();
        }
    }
};

function resetGame() {
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    pipes.position = [];
    frames = 0;
}

// Event Listener untuk Desktop (Spasi)
window.addEventListener("keydown", (e) => {
    if(e.code === "Space") {
        e.preventDefault();
        bird.flap();
    }
});

// Event Listener untuk Mobile (Sentuhan)
window.addEventListener("touchstart", (e) => {
    // Mencegah perilaku default browser seperti scrolling
    if (e.target === canvas) {
        e.preventDefault();
        bird.flap();
    }
}, { passive: false });

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background Langit
    ctx.fillStyle = "#70c5ce";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    pipes.draw();
    pipes.update();
    bird.draw();
    bird.update();
    
    // Tampilan Skor Sederhana
    ctx.fillStyle = "#FFF";
    ctx.font = "20px Arial";
    ctx.fillText(`Score: ${Math.floor(frames/100)}`, 10, 25);
    
    frames++;
    requestAnimationFrame(loop);
}

loop();
