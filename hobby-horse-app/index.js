const express = require('express');
const fs = require('fs');
const app = express();
const PORT = 3000;
const DATA_FILE = 'data.txt';

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

function readRawData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return fs.readFileSync(DATA_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      const [name, horse, category, t1, p1, t2, p2] = line.split(',');
      return {
        index,
        name,
        horse,
        category,
        run1: { time: parseFloat(t1) || 0, penalty: parseInt(p1) || 0 },
        run2: { time: parseFloat(t2) || 0, penalty: parseInt(p2) || 0 }
      };
    });
}

function writeData(data) {
  const lines = data.map(c =>
    `${c.name},${c.horse},${c.category},${c.run1.time},${c.run1.penalty},${c.run2.time},${c.run2.penalty}`
  );
  fs.writeFileSync(DATA_FILE, lines.join('\n'));
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  const ms = String(Math.round((seconds % 1) * 1000)).padStart(3, '0');
  return `${m}:${s}.${ms}`;
}
function readSortedDataByCategory(category) {
  return readRawData()
    .filter(c => c.category === category)
    .map(c => {
      const r1 = c.run1.time > 0;
      const r2 = c.run2.time > 0;
      let best = 0;
      let score = [Infinity, Infinity];

      if (r1 && (!r2 || c.run1.penalty < c.run2.penalty || (c.run1.penalty === c.run2.penalty && c.run1.time <= c.run2.time))) {
        best = 1;
        score = [c.run1.penalty, c.run1.time];
      } else if (r2) {
        best = 2;
        score = [c.run2.penalty, c.run2.time];
      }

      return { ...c, best, bestScore: score };
    })
    .filter(c => c.best > 0)
    .sort((a, b) => a.bestScore[0] - b.bestScore[0] || a.bestScore[1] - b.bestScore[1])
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

function generateTable(data) {
  return data.map(c => `
    <tr>
      <td>${c.rank}</td>
      <td>${c.name}</td>
      <td>${c.horse}</td>
      <td style="background:${c.best === 1 ? '#c8f7c5' : ''}">${formatTime(c.run1.time)}<br>+${c.run1.penalty}</td>
      <td style="background:${c.best === 2 ? '#c8f7c5' : ''}">${formatTime(c.run2.time)}<br>+${c.run2.penalty}</td>
      <td>
        <button onclick="openEditModal(${c.index})">Edit</button>
        <form method="POST" action="/delete" onsubmit="return confirm('Delete?')" style="display:inline;">
          <input type="hidden" name="index" value="${c.index}" />
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`).join('');
}
app.get('/', (req, res) => {
  const categories = ['A', 'B', 'Open'];
  const tabs = categories.map(cat => `
    <div id="${cat}" class="tab-content" style="display:none;">
      <table>
        <thead><tr>
          <th>Rank</th><th>Name</th><th>Horse</th><th>Run 1</th><th>Run 2</th><th>Actions</th>
        </tr></thead>
        <tbody>${generateTable(readSortedDataByCategory(cat))}</tbody>
      </table>
    </div>`).join('');

  res.send(`
    <html>
    <head>
      <title>Hobby Horse</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        table, th, td { border: 1px solid #000; border-collapse: collapse; padding: 8px; }
        table { width: 100%; margin-top: 10px; }
        .tab-btn { margin: 5px; padding: 8px; cursor: pointer; }
        .tab-content { display: none; }
        .modal { display: none; position: fixed; top:0; left:0; width:100%; height:100%;
          background: rgba(0,0,0,0.4); align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: white; padding: 20px; border-radius: 10px; width: 400px; }
      </style>
      <script>
        function showTab(cat) {
          document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
          document.getElementById(cat).style.display = 'block';
        }
        window.onload = () => showTab('A');

        function openEditModal(index) {
          fetch('/edit-json?index=' + index).then(r => r.json()).then(c => {
            document.getElementById('edit-index').value = index;
            document.getElementById('edit-name').value = c.name;
            document.getElementById('edit-horse').value = c.horse;
            document.getElementById('edit-category').value = c.category;
            document.getElementById('edit-m1').value = Math.floor(c.run1.time / 60);
            document.getElementById('edit-s1').value = Math.floor(c.run1.time % 60);
            document.getElementById('edit-ms1').value = Math.round((c.run1.time % 1) * 1000);
            document.getElementById('edit-p1').value = c.run1.penalty;
            document.getElementById('edit-m2').value = Math.floor(c.run2.time / 60);
            document.getElementById('edit-s2').value = Math.floor(c.run2.time % 60);
            document.getElementById('edit-ms2').value = Math.round((c.run2.time % 1) * 1000);
            document.getElementById('edit-p2').value = c.run2.penalty;
            document.getElementById('modal').style.display = 'flex';
          });
        }
        function closeModal() {
          document.getElementById('modal').style.display = 'none';
        }
      </script>
    </head>
    <body>
      <h1>🏇 Hobby Horse Competition - 15.06.2025</h1>
      <form method="POST" action="/add-run">
        <input name="name" placeholder="Name" required>
        <input name="horse" placeholder="Horse" required>
        <select name="category" required><option>A</option><option>B</option><option>Open</option></select>
        <select name="runNumber"><option value="1">Run 1</option><option value="2">Run 2</option></select>
        <input name="minutes" placeholder="Min" type="number" style="width:50px">
        :<input name="seconds" placeholder="Sec" type="number" style="width:50px">
        .<input name="millis" placeholder="Ms" type="number" style="width:50px">
        +<input name="penalty" placeholder="Penalty" type="number" style="width:50px">
        <button type="submit">Add</button>
      </form>

      <div>
        ${categories.map(c => `<button class="tab-btn" onclick="showTab('${c}')">${c}</button>`).join('')}
      </div>
      ${tabs}

      <p>Print results by category:
        <a href="/print/A" target="_blank">A</a> |
        <a href="/print/B" target="_blank">B</a> |
        <a href="/print/Open" target="_blank">Open</a>
      </p>

      <div id="modal" class="modal">
        <div class="modal-content">
          <form method="POST" action="/edit">
            <input type="hidden" name="index" id="edit-index" />
            Name: <input name="name" id="edit-name" /><br>
            Horse: <input name="horse" id="edit-horse" /><br>
            Category:
            <select name="category" id="edit-category"><option>A</option><option>B</option><option>Open</option></select><br>
            Run 1: <input name="m1" id="edit-m1" type="number" style="width:40px"> :
                   <input name="s1" id="edit-s1" type="number" style="width:40px"> .
                   <input name="ms1" id="edit-ms1" type="number" style="width:60px"> + 
                   <input name="p1" id="edit-p1" type="number" style="width:40px"><br>
            Run 2: <input name="m2" id="edit-m2" type="number" style="width:40px"> :
                   <input name="s2" id="edit-s2" type="number" style="width:40px"> .
                   <input name="ms2" id="edit-ms2" type="number" style="width:60px"> + 
                   <input name="p2" id="edit-p2" type="number" style="width:40px"><br>
            <button type="submit">Save</button>
            <button type="button" onclick="closeModal()">Cancel</button>
          </form>
        </div>
      </div>
    </body>
    </html>
  `);
});
app.get('/edit-json', (req, res) => {
  const data = readRawData();
  res.json(data[parseInt(req.query.index)]);
});

app.post('/add-run', (req, res) => {
  const { name, horse, category, runNumber, minutes, seconds, millis, penalty } = req.body;
  const time = parseFloat(minutes) * 60 + parseFloat(seconds) + parseFloat(millis) / 1000;
  let data = readRawData();
  let person = data.find(d => d.name === name && d.horse === horse && d.category === category);
  if (!person) {
    person = {
      name, horse, category,
      run1: { time: 0, penalty: 0 },
      run2: { time: 0, penalty: 0 }
    };
    data.push(person);
  }
  person[`run${runNumber}`] = { time, penalty: parseInt(penalty) };
  writeData(data);
  res.redirect('/');
});

app.post('/edit', (req, res) => {
  const {
    index, name, horse, category,
    m1, s1, ms1, p1,
    m2, s2, ms2, p2
  } = req.body;

  let data = readRawData();
  data[index] = {
    name,
    horse,
    category,
    run1: {
      time: parseFloat(m1) * 60 + parseFloat(s1) + parseFloat(ms1) / 1000,
      penalty: parseInt(p1)
    },
    run2: {
      time: parseFloat(m2) * 60 + parseFloat(s2) + parseFloat(ms2) / 1000,
      penalty: parseInt(p2)
    }
  };
  writeData(data);
  res.redirect('/');
});

app.post('/delete', (req, res) => {
  const { index } = req.body;
  let data = readRawData();
  data.splice(index, 1);
  writeData(data);
  res.redirect('/');
});

app.get('/print/:category', (req, res) => {
  const cat = req.params.category;
  const data = readSortedDataByCategory(cat);
  res.send(`
    <html>
    <head>
      <title>Print Results - ${cat}</title>
      <style>
        body { font-family: Arial; margin: 40px; }
        table, th, td { border: 1px solid black; border-collapse: collapse; padding: 8px; }
        table { width: 100%; margin-top: 30px; }
        @media print { a { display: none; } }
      </style>
    </head>
    <body>
      <h1>🏇 Hobby Horse Final Results - ${cat}</h1>
      <a href="#" onclick="window.print()">Click here to print</a>
      <table>
        <thead><tr><th>Rank</th><th>Name</th><th>Horse</th><th>Run 1</th><th>Run 2</th></tr></thead>
        <tbody>
          ${data.map(c => `
            <tr>
              <td>${c.rank}</td>
              <td>${c.name}</td>
              <td>${c.horse}</td>
              <td>${formatTime(c.run1.time)}<br>+${c.run1.penalty}</td>
              <td>${formatTime(c.run2.time)}<br>+${c.run2.penalty}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `);
});

app.listen(PORT, () => console.log("Listening on http://localhost:" + PORT));

