export const CONTINENTS=['亚洲','欧洲','非洲','北美洲','南美洲','大洋洲','南极洲'];
export function journeyTree(cities,countries){
 return CONTINENTS.map(name=>({name,countries:Object.entries(countries).filter(([id,country])=>country.continent===name&&cities.some(city=>city.properties.country===id&&city.properties.visited!==false)).map(([id,country])=>{
  const members=cities.filter(city=>city.properties.country===id&&city.properties.visited!==false),regions=[...new Set(members.map(city=>city.properties.region||'其他地区'))];
  return {id,name:country.name,regions:regions.map(name=>({name,cities:members.filter(city=>(city.properties.region||'其他地区')===name)}))};
 })}));
}
