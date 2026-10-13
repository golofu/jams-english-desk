// Dev harness (paste into the preview page): replaces getUserMedia with a silent
// synthetic mic so calls can run in a browser pane that blocks real microphones.
(() => {
  window.__fakeTracks = [];
  navigator.mediaDevices.getUserMedia = async () => {
    const ac = new AudioContext();
    const dest = ac.createMediaStreamDestination();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    g.gain.value = 0; // silence
    osc.connect(g).connect(dest);
    osc.start();
    const t = dest.stream.getAudioTracks()[0];
    window.__fakeTracks.push(t);
    return dest.stream;
  };
  return 'fake mic installed';
})();
