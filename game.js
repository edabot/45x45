// ── Constants ──────────────────────────────────────────────
const M = 45;

// ── State ──────────────────────────────────────────────────
var score = 0;
var mistakes = 0;
var selected = null;
var groupCounter = 0;
var dragSrcCard = null;
var wordlist = [];

// ── Helpers ────────────────────────────────────────────────
function stringToLightColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    const s = 70;
    const l = 80 + (Math.abs(hash) % 10);
    const lDev = l / 100;
    const a = (s * Math.min(lDev, 1 - lDev)) / 100;
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = lDev - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// ── Deselect ───────────────────────────────────────────────
function deselect() {
    if (selected) {
        selected.classList.remove('selected');
        selected = null;
    }
}

// Right-click anywhere deselects
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    deselect();
});

// ── Group card display ────────────────────────────────────
function groupDisplayName(card) {
    return card.customName || ('Group ' + card.groupNumber);
}

function updateGroupCard(card) {
    var name = groupDisplayName(card);
    if (card.cluster.length === 45) {
        card.style.background = stringToLightColor(card.category);
        card.classList.add('completed');
        card.disabled = true;
        card.innerHTML =
            '<span class="card-header">' +
                '<span class="card-name">' + name + '</span>' +
            '</span>' +
            '<span class="card-count">&#10003; All 45 found!</span>';
    } else {
        var preview = card.cluster.join(', ');
        var pct = (card.cluster.length / 45 * 100).toFixed(1);
        card.innerHTML =
            '<span class="card-header">' +
                '<span class="card-name">' + name + '</span>' +
                '<span class="card-edit-btn" onclick="editGroupName(event, this)">edit</span>' +
            '</span>' +
            '<span class="card-preview">' + preview + '</span>' +
            '<span class="card-progress"><span class="card-progress-bar" style="width:' + pct + '%"></span></span>' +
            '<span class="card-count">' + card.cluster.length + '/45</span>';
    }
}

// ── Inline rename ──────────────────────────────────────────
function editGroupName(evt, editSpan) {
    evt.stopPropagation();
    var card = editSpan.closest('.group-card');
    var nameSpan = card.querySelector('.card-name');
    var currentName = groupDisplayName(card);

    var input = document.createElement('input');
    input.className = 'card-name-input';
    input.value = currentName;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
        var newName = input.value.trim();
        card.customName = newName || null;
        updateGroupCard(card);
        saveState();
    }

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter')  { e.stopPropagation(); input.blur(); }
        if (e.key === 'Escape') { e.stopPropagation(); card.customName = card.customName; updateGroupCard(card); }
    });
    input.addEventListener('blur', commit);
    input.addEventListener('click', function(e) { e.stopPropagation(); });
    input.addEventListener('mousedown', function(e) { e.stopPropagation(); });
}

// ── Drag-to-reorder for group cards ───────────────────────
function initDragOnCard(card) {
    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', function(e) {
        dragSrcCard = card;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(function() { card.classList.add('dragging'); }, 0);
    });

    card.addEventListener('dragend', function() {
        card.classList.remove('dragging');
        document.querySelectorAll('.group-card.drag-before, .group-card.drag-after')
            .forEach(function(c) { c.classList.remove('drag-before', 'drag-after'); });
        dragSrcCard = null;
        saveState();
    });

    card.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSrcCard === card) return;
        document.querySelectorAll('.group-card.drag-before, .group-card.drag-after')
            .forEach(function(c) { c.classList.remove('drag-before', 'drag-after'); });
        var rect = card.getBoundingClientRect();
        card.classList.add(e.clientX < rect.left + rect.width / 2 ? 'drag-before' : 'drag-after');
    });

    card.addEventListener('dragleave', function() {
        card.classList.remove('drag-before', 'drag-after');
    });

    card.addEventListener('drop', function(e) {
        e.preventDefault();
        if (!dragSrcCard || dragSrcCard === card) return;
        var container = document.getElementById('groups-container');
        var rect = card.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) {
            container.insertBefore(dragSrcCard, card);
        } else {
            container.insertBefore(dragSrcCard, card.nextSibling);
        }
        card.classList.remove('drag-before', 'drag-after');
    });
}

// ── Click handler (works for both board buttons and group cards) ──
function attachClickHandler(btn) {
    btn.onclick = function() {
        if (btn.disabled) return;

        if (selected === btn) {
            deselect();
            return;
        }

        if (selected) {
            var prev = selected;
            deselect();
            attemptMatch(btn, prev);
        } else {
            selected = btn;
            btn.classList.add('selected');
        }
    };
}

// ── Attempt match ─────────────────────────────────────────
function attemptMatch(a, b) {
    if (a.category === b.category) {
        doMerge(a, b);
    } else {
        mistakes++;
        document.getElementById('mistakes').textContent = mistakes;
        [a, b].forEach(function(btn) {
            btn.classList.add('shake');
            btn.addEventListener('animationend', function() {
                btn.classList.remove('shake');
            }, { once: true });
        });
        saveState();
    }
}

// ── Merge two matched buttons ─────────────────────────────
function doMerge(a, b) {
    // Group card absorbs the board button (or either group card absorbs the other)
    var survivor = b.isGroupCard ? b : a;
    var absorbed  = b.isGroupCard ? a : b;

    // Merge clusters into survivor
    survivor.cluster = survivor.cluster.concat(absorbed.cluster);

    // Name inheritance:
    // absorbed.customName set → survivor takes it (covers named+generic and named+named)
    if (absorbed.customName) {
        survivor.customName = absorbed.customName;
    }

    // Remove absorbed from DOM
    if (absorbed.isGroupCard) {
        absorbed.remove();
    } else {
        absorbed.parentElement.remove(); // remove .cell
    }

    // If survivor is still on the board, move it to groups section
    var container = document.getElementById('groups-container');
    if (!survivor.isGroupCard) {
        survivor.isGroupCard = true;
        groupCounter++;
        survivor.groupNumber = groupCounter;
        survivor.customName  = survivor.customName || null;
        survivor.parentElement.remove(); // remove .cell
        survivor.classList.remove('cell-button');
        survivor.classList.add('group-card');
        initDragOnCard(survivor);
        container.appendChild(survivor);
    }

    // Update group card display
    updateGroupCard(survivor);

    // Show groups section on first merge
    document.getElementById('groups-section').style.display = 'block';

    // Update score
    score++;
    document.getElementById('score').textContent = score;

    saveState();

    if (score === 1980) {
        setTimeout(function() { alert('You win!!'); }, 200);
        startFireworks();
    }
}

// ── Check categories data ─────────────────────────────────
function checkCategories() {
    var wordDict = new Map();
    for (var key in cats) {
        var value = cats[key];
        if (value.length < 45) {
            alert('Entry for ' + key + ' has length ' + value.length);
        }
        for (var i = 0; i < 45; i++) {
            wordlist.push([value[i], key]);
            if (wordDict.has(value[i])) {
                alert('Duplicate word: ' + value[i]);
            } else {
                wordDict.set(value[i], true);
            }
        }
    }
}

// ── Build the DOM board (empty cells) ─────────────────────
function setUpBoard() {
    var board = document.createElement('div');
    board.id = 'the_board';
    for (var i = 0; i < M * M; i++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        var btn = document.createElement('button');
        btn.className = 'cell-button';
        btn.isGroupCard = false;
        attachClickHandler(btn);
        cell.appendChild(btn);
        board.appendChild(cell);
    }
    document.getElementById('board').appendChild(board);
}

// ── Fill board cells with shuffled words ──────────────────
function putWordsInBoard() {
    shuffleArray(wordlist);
    var cells = document.querySelectorAll('#the_board .cell');
    for (var i = 0; i < cells.length; i++) {
        var btn = cells[i].firstElementChild;
        btn.textContent = wordlist[i][0];
        btn.category    = wordlist[i][1];
        btn.cluster     = [wordlist[i][0]];
    }
}

// ── Save state to localStorage ────────────────────────────
function saveState() {
    localStorage.clear();
    localStorage.setItem('score', score);
    localStorage.setItem('mistakes', mistakes);

    // Board: save remaining word/category pairs in DOM order
    var boardWords = [];
    document.querySelectorAll('#the_board .cell-button').forEach(function(btn) {
        if (btn.textContent && btn.category) {
            boardWords.push({ word: btn.textContent, category: btn.category });
        }
    });
    localStorage.setItem('boardWords', JSON.stringify(boardWords));

    // Groups: save category, cluster, groupNumber, customName
    var groupsData = [];
    document.querySelectorAll('#groups-container .group-card').forEach(function(card) {
        groupsData.push({
            category:    card.category,
            cluster:     card.cluster,
            groupNumber: card.groupNumber,
            customName:  card.customName || null
        });
    });
    localStorage.setItem('groupsData', JSON.stringify(groupsData));
    localStorage.setItem('groupCounter', groupCounter);
}

// ── Load state from localStorage ──────────────────────────
function loadState() {
    var s = localStorage.getItem('score');
    if (s === null) {
        putWordsInBoard();
        return;
    }

    score = Number(s);
    document.getElementById('score').textContent = score;
    mistakes = Number(localStorage.getItem('mistakes') || 0);
    document.getElementById('mistakes').textContent = mistakes;

    // Restore board
    var boardWordsStr = localStorage.getItem('boardWords');
    if (!boardWordsStr) {
        putWordsInBoard();
        return;
    }
    var boardWords = JSON.parse(boardWordsStr);

    // Collect all cells, fill with saved words, remove extras
    var cells = Array.from(document.querySelectorAll('#the_board .cell'));
    for (var ci = 0; ci < cells.length; ci++) {
        if (ci < boardWords.length) {
            var btn = cells[ci].firstElementChild;
            btn.textContent = boardWords[ci].word;
            btn.category    = boardWords[ci].category;
            btn.cluster     = [boardWords[ci].word];
        } else {
            cells[ci].remove();
        }
    }

    // Restore groups
    var groupsStr = localStorage.getItem('groupsData');
    if (groupsStr) {
        var groupsData = JSON.parse(groupsStr);
        var container = document.getElementById('groups-container');
        groupCounter = Number(localStorage.getItem('groupCounter') || 0);
        groupsData.forEach(function(g) {
            var card = document.createElement('button');
            card.className   = 'group-card';
            card.category    = g.category;
            card.cluster     = g.cluster;
            card.groupNumber = g.groupNumber;
            card.customName  = g.customName || null;
            card.isGroupCard = true;
            attachClickHandler(card);
            initDragOnCard(card);
            updateGroupCard(card);
            container.appendChild(card);
        });
        if (groupsData.length > 0) {
            document.getElementById('groups-section').style.display = 'block';
        }
    }
}

// ── Fireworks ─────────────────────────────────────────────
function startFireworks() {
    var canvas = document.getElementById('fireworks');
    var ctx = canvas.getContext('2d');
    var w, h;
    var particles = [];
    var fireworks = [];

    function resize() {
        w = canvas.width  = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function Firework() {
        this.x     = Math.random() * w;
        this.y     = h;
        this.tx    = Math.random() * w;
        this.ty    = Math.random() * (h / 2);
        this.color = 'hsl(' + (Math.random() * 360) + ',100%,50%)';
        this.speed = 2 + Math.random() * 2;
        this.angle = Math.atan2(this.ty - this.y, this.tx - this.x);
        this.vx    = Math.cos(this.angle) * this.speed;
        this.vy    = Math.sin(this.angle) * this.speed;
        this.exploded = false;
    }
    Firework.prototype.update = function() {
        this.x += this.vx;
        this.y += this.vy;
        if ((this.vy < 0 && this.y < this.ty) || (this.vy > 0 && this.y > this.ty)) {
            this.exploded = true;
            for (var i = 0; i < 50; i++) {
                particles.push(new Particle(this.x, this.y, this.color));
            }
        }
    };
    Firework.prototype.draw = function() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    };

    function Particle(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        var angle = Math.random() * Math.PI * 2;
        var speed = Math.random() * 3;
        this.vx    = Math.cos(angle) * speed;
        this.vy    = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = Math.random() * 0.015 + 0.005;
    }
    Particle.prototype.update = function() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.05;
        this.alpha -= this.decay;
    };
    Particle.prototype.draw = function() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    };

    function loop() {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';

        if (Math.random() < 0.05) fireworks.push(new Firework());

        for (var i = fireworks.length - 1; i >= 0; i--) {
            fireworks[i].update();
            fireworks[i].draw();
            if (fireworks[i].exploded) fireworks.splice(i, 1);
        }
        for (var j = particles.length - 1; j >= 0; j--) {
            particles[j].update();
            particles[j].draw();
            if (particles[j].alpha <= 0) particles.splice(j, 1);
        }
        requestAnimationFrame(loop);
    }
    loop();
}

// ── Init ──────────────────────────────────────────────────
checkCategories();
setUpBoard();
loadState();
