import {mountGuide} from './guide.js?v=20261102-easy';
const assistant=document.documentElement.dataset.guidePage==='assistant';
mountGuide({host:document.querySelector(assistant?'header .actions':'.top'),page:assistant?'assistant':'wheel',dark:assistant});
