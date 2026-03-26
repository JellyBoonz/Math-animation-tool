  ## Phase 1 — Make the demo possible                                                        
  1. **Parametric trails** — a point that records its position over time and draws the path.  
  This is the Spirograph. Everything else is secondary to this.                           
  2. **Line segment primitive** — the arm connecting circle centers. Simple to render, makes
  the mechanical structure visible, which is key to the "oh I get it" moment.             
  3. **Opacity / visibility as animatable params** — things need to fade in and out. Without  
  this, everything snaps and it looks unpolished.                                       
                                                                                          
  ## Phase 2 — Make it a video
  4. **Video export** — MediaRecorder on the canvas stream piped to a downloadable file. The  
  entire project is pointless without this. It's not glamorous but it's the real MVP gate.
  5. **Timeline / cue system** — a simple way to say "at t=4, show this object." Doesn't need 
  to be a full keyframe editor. Even a startTime and endTime per object gets you 80% of   
  the way there.  
                                                                                          
  ## Phase 3 — Make it beautiful
  6. **Draw-on effect** — animate the trail being drawn from nothing. This is what makes the
  Spirograph fill-in visually satisfying rather than just appearing all at once.          
  7. **Camera animation** — pan/zoom driven by expressions, not just mouse. Lets you zoom into
   the pattern as it fills.                                                               
  8. **Dark background option** — Spirographs look dramatically better on black. One toggle,
  high visual payoff.                                                                     
                  
  ## Phase 4 — Make it a product                                                             
  9. **LaTeX labels** — once the demo is done, this is what elevates it from "cool animation
  tool" to "math education tool."                                                         
  10. **More primitives** — vectors with arrowheads, polygons, points. Fill in the gaps after
  the core demo works