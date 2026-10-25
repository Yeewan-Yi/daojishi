export const PROGRESS={open:{title:'待议',states:['open']},working:{title:'处理中',states:['review','working','transferred']},done:{title:'已完成',states:['done']},paused:{title:'暂不处理',states:['paused','declined']}};
export function progressKey(state){return Object.keys(PROGRESS).find(key=>PROGRESS[key].states.includes(state));}
export const progressTitle=state=>PROGRESS[progressKey(state)]?.title||state;
export const progressStates=keys=>[...new Set(keys.flatMap(key=>PROGRESS[key]?.states||[]))];
export function selectFilter(selected,value,exclusive=false){return !value?[]:exclusive?[value]:selected.includes(value)?selected.filter(key=>key!==value):[...selected,value];}
export function outsideCouncilPointer(event,{open,panel,button,composing=false,compositionEnded=-Infinity,focused=true}){if(!open||event.button!==0||composing||!focused||event.timeStamp-compositionEnded<400)return false;const path=event.composedPath?.()||[];return !path.includes(panel)&&!path.includes(button)&&!panel?.contains(event.target)&&!button?.contains(event.target);}
