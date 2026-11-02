import {mountGuide} from './guide.js';
const assistant=document.documentElement.dataset.guidePage==='assistant';
mountGuide({host:document.querySelector(assistant?'header .actions':'.top'),page:assistant?'assistant':'wheel',dark:assistant});
