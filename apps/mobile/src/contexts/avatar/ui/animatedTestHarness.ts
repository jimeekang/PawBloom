/** Deterministic numeric Animated mock shared by avatar motion regression tests. */
export function createAnimatedTestHarness() {
  let nodes = 0;
  class Node {
    constructor(public read: () => number) { nodes++; }
    __getValue(): number { return this.read(); }
    addListener(_callback: any): string { return 'derived'; }
    removeListener(_key: string) {}
    interpolate(options: { inputRange: number[]; outputRange: number[]; extrapolate?: string }) {
      return new Node(() => {
        const value = this.__getValue(), input = options.inputRange, output = options.outputRange;
        if (value <= input[0]!) return output[0]!;
        if (value >= input[input.length-1]!) return output[output.length-1]!;
        let i=0; while (value > input[i+1]!) i++;
        return output[i]! + (value-input[i]!)/(input[i+1]!-input[i]!)*(output[i+1]!-output[i]!);
      });
    }
  }
  class Value extends Node {
    value: number;
    listeners = new Map<string, (value: {value:number}) => void>();
    constructor(initial: number) { super(() => this.value); this.value = initial; }
    setValue(next: number) { this.value=next; this.listeners.forEach(fn => fn({value:next})); }
    addListener(fn: (value: {value:number}) => void) { const key=String(this.listeners.size); this.listeners.set(key,fn); return key; }
    removeListener(key: string) { this.listeners.delete(key); }
  }
  type Animation = { kind:string; running:boolean; value?:Value; options?:any; children?:Animation[]; start: (callback?:any) => void; stop: () => void };
  const animations: Animation[] = [];
  function animation(kind: string, value?: Value, options?: any, children?: Animation[]): Animation {
    const item: Animation = { kind,value,options,children,running:false,start() { this.running=true; this.children?.forEach(child => child.start()); },stop() { this.running=false; this.children?.forEach(child => child.stop()); } };
    animations.push(item); return item;
  }
  const number = (node: Node | number) => typeof node === 'number' ? node : node.__getValue();
  const Animated = {
    Value,
    subtract: (a:Node|number,b:Node|number) => new Node(() => number(a)-number(b)),
    modulo: (a:Node|number,b:number) => new Node(() => ((number(a)%b)+b)%b),
    timing: (value:Value,options:any) => animation('timing',value,options),
    spring: (value:Value,options:any) => animation('spring',value,options),
    loop: (child:Animation,options:any) => animation('loop',undefined,options,[child]),
    sequence: (children:Animation[]) => animation('sequence',undefined,undefined,children),
  };
  let now = new Date(2026,9,30,12).getTime(), id=0;
  const pending = new Map<number,{at:number;fn:()=>void}>(), history: Array<()=>void> = [];
  const clock = { now:() => new Date(now), setTimeout(fn:()=>void,ms:number) { const key=++id; pending.set(key,{at:now+ms,fn}); history.push(fn); return key as unknown as ReturnType<typeof setTimeout>; },clearTimeout(key:ReturnType<typeof setTimeout>) { pending.delete(key as unknown as number); } };
  function advance(ms:number) {
    const until=now+ms;
    while (true) {
      const next=[...pending].filter(([,timer]) => timer.at<=until).sort((a,b) => a[1].at-b[1].at)[0];
      if (!next) break;
      now=next[1].at; pending.delete(next[0]); next[1].fn();
    }
    now=until;
  }
  const appListeners = new Set<(state:string)=>void>();
  const AppState = {currentState:'active',addEventListener(_name:string,fn:(state:string)=>void) { appListeners.add(fn); return {remove:() => appListeners.delete(fn)}; } };
  return { Animated,AppState,animations,clock,history,pending,advance,get nodes(){return nodes;},setDate(date:Date){now=date.getTime();},appState(state:string){AppState.currentState=state; appListeners.forEach(fn=>fn(state));},frame(value:Value,index:number){value.setValue(index);} };
}
