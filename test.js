const bcrypt = require('bcrypt');

async function test() {
  const hash = "$2b$10$JfvDkaA9H9n1tFoZT3zh/OgVyhi3F7Wv/MManIeZDV4SSQdlqzTe2"; 
  const ok = await bcrypt.compare("123456", hash);
  console.log("match? ", ok);
}

test();
