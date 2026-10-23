export const CONTINENTS=['亚洲','欧洲','非洲','北美洲','南美洲','大洋洲','南极洲'];
export function cityChoices(cities,current,countries,query=''){
 const reference=current?.properties||{},continent=countries[reference.country]?.continent,needle=query.trim().toLocaleLowerCase(),compare=new Intl.Collator('zh-CN',{numeric:true}).compare;
 return cities.filter(city=>city.properties.visited!==false).map(city=>{
  const p=city.properties,country=countries[p.country]||{name:p.country,continent:''};
  const rank=p.country===reference.country?(p.region&&p.region===reference.region?0:1):continent&&country.continent===continent?2:3;
  return {city,rank,country,description:[country.continent,country.name,p.region].filter(Boolean).join(' · ')};
 }).filter(row=>!needle||[row.city.properties.name,row.description].join(' ').toLocaleLowerCase().includes(needle)).sort((a,b)=>a.rank-b.rank||Number(b.city.properties.id===reference.id)-Number(a.city.properties.id===reference.id)||compare(a.city.properties.name,b.city.properties.name)||compare(a.description,b.description));
}
export function journeyTree(cities,countries){
 return CONTINENTS.map(name=>({name,countries:Object.entries(countries).filter(([id,country])=>country.continent===name&&cities.some(city=>city.properties.country===id&&city.properties.visited!==false)).map(([id,country])=>{
  const members=cities.filter(city=>city.properties.country===id&&city.properties.visited!==false),regions=[...new Set(members.map(city=>city.properties.region||'其他地区'))];
  return {id,name:country.name,regions:regions.map(name=>({name,cities:members.filter(city=>(city.properties.region||'其他地区')===name)}))};
 })}));
}
