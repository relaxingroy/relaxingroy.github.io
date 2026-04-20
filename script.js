const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 320;
canvas.height = 480;

// Variabel Game
let frames = 0;
const gravity = 0.25;

const bird = {
    x: 50,
    y: 150,
    w: 20,
    h: 20,
    velocity: 0,
    jump: 4.6,
    draw: function() {
        ctx.fillStyle = "#f2e007";
        ctx.fillRect(this.x, this.y, this.w, this.h);
    },
    update: function() {
        this.velocity += gravity;
        this.y += this.velocity;

        if (this.y + this.h >= canvas.height) {
            this.y = canvas.height - this.h;
            resetGame();
        }
    },
    flap: function() {
        this.velocity = -this.jump;
    }
};

const pipes = {
    position: [],
    gap: 100,
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
        if(frames % 100 === 0) {
            this.position.push({
                x: canvas.width,
                y: Math.floor(Math.random() * (canvas.height - this.gap - 100)) + 50
            });
        }
        for(let i = 0; i < this.position.length; i++) {
            let p = this.position[i];
            p.x -= 2;

            // Cek Tabrakan
            if(bird.x + bird.w > p.x && bird.x < p.x + this.width &&
              (bird.y < p.y || bird.y + bird.h > p.y + this.gap)) {
                resetGame();
            }

            if(p.x + this.width <= 0) this.position.shift();
        }
    }
};

function resetGame() {
    bird.y = 150;
    bird.velocity = 0;
    pipes.position = [];
    frames = 0;
}

window.addEventListener("keydown", (e) => {
    if(e.code === "Space") bird.flap();
});

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    bird.draw();
    bird.update();
    pipes.draw();
    pipes.update();
    
    frames++;
    requestAnimationFrame(loop);
}

loop();
