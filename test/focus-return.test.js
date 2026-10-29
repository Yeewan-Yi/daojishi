import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {focusPageTool} from '../shared/focus-return.js';
test('closing a sidebar returns focus to More when the original mobile tool is hidden, and to the actual desktop tool otherwise',()=>{
 const {document}=parseHTML('<nav><button class="mobile-tools-toggle"></button><div class="mobile-tools-panel"><button id="tool"></button></div></nav>');
 const tool=document.querySelector('#tool'),more=document.querySelector('.mobile-tools-toggle'),menu=document.querySelector('.mobile-tools-panel');let focused;
 tool.focus=()=>{focused=tool;};more.focus=()=>{focused=more;};
 menu.inert=true;focusPageTool(tool);assert.equal(focused,more);
 menu.inert=false;menu.hidden=true;focusPageTool(tool);assert.equal(focused,more);
 menu.hidden=false;focusPageTool(tool);assert.equal(focused,tool);
 menu.parentElement.append(tool);menu.inert=true;focusPageTool(tool);assert.equal(focused,tool);
});
