const express = require('express');
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' }); // connecting to Docker engine running on the host

const app = express();

app.use(express.json());

app.post('/compile', async (req, res) => {
  const { code, language } = req.body;

  let imageName, cmd;

  // Define image name and command based on language
  if (language === 'python') {
    imageName = 'python:3.9';
    cmd = 'python -c';
  } else if (language === 'nodejs') {
    imageName = 'node:14';
    cmd = 'node -e';
  } // add more conditions here for more languages

  if (!imageName || !cmd) {
    return res.status(400).json({ error: 'Invalid language specified' });
  }
  docker.pull(imageName, function(err, stream) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
  
    // Stream the docker pull output to stdout
    docker.modem.followProgress(stream, (err, res) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      // Image pull complete, proceed to create container and run it.
      // (the rest of your existing code to create and run the container)
    });
  });
  
  // Create a container
  docker.createContainer({
    Image: imageName,
    Cmd: ['/bin/sh', '-c', `${cmd} "${code}"`],  // Note this line
    AttachStdout: true,
    AttachStderr: true,
  }, function(err, container) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Run the container
    container.start({}, function(err, data) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Attach container streams to process streams
      container.attach({stream: true, stdout: true, stderr: true}, function(err, stream) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        let output = '';
        
        stream.on('data', function(chunk) {
          output += chunk.toString();
        });

        stream.on('end', function() {
          container.remove(function(err, data) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            res.json({ output });
          });
        });
      });
    });
  });
});

app.listen(8080, () => {
  console.log('Server running on http://localhost:8080');
});
