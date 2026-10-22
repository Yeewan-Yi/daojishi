"""Train a small preference ranking head; requires an explicitly saved review."""
import json, argparse
from pathlib import Path
import numpy as np
parser=argparse.ArgumentParser();parser.add_argument('--analysis',default='output/hongshan.json');parser.add_argument('--review',default='output/review.json');parser.add_argument('--output',default='output/preferences.json');args=parser.parse_args()
analysis=json.loads(Path(args.analysis).read_text(encoding='utf-8'));review=json.loads(Path(args.review).read_text(encoding='utf-8'))
if review.get('provenance')=='automated-verification':raise SystemExit('Waiting for a real manual review; automated verification is not preference training data.')
rows=analysis['photos'];ids={r['id'] for r in rows};selected=set(review['covers'])
if not selected.issubset(ids) or len(selected)<4 or len(rows)-len(selected)<10:raise SystemExit('Need at least 4 explicitly selected covers and 10 alternatives before training.')
x=np.array([r['embedding'] for r in rows],dtype=np.float64);x/=np.maximum(np.linalg.norm(x,axis=1,keepdims=True),1e-12);y=np.array([1.0 if r['id'] in selected else 0.0 for r in rows]);
def fit(a,b):
    # Dual ridge regression is cheap even when embedding dimension exceeds sample count.
    return a.T@np.linalg.solve(a@a.T+np.eye(len(a))*.5,b-b.mean())
positives=np.where(y==1)[0];negatives=np.where(y==0)[0];scores=[]
for held in positives:
    train=np.array([i for i in range(len(rows)) if i!=held and i not in negatives[::3]])
    w=fit(x[train],y[train]);p=float(x[held]@w);n=x[negatives[::3]]@w;scores.append(float(np.mean(p>n)))
validation=float(np.mean(scores));weights=fit(x,y);out=dict(kind='clip-preference-ridge-v1',model=analysis['model'],revision=analysis['revision'],weights=weights.tolist(),selected_examples=len(selected),alternative_examples=len(rows)-len(selected),held_out_pairwise_accuracy=validation,validated=validation>=.7,note='Small personal dataset; compare recommendations before replacing existing covers.')
Path(args.output).write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in out.items() if k!='weights'},ensure_ascii=False))
