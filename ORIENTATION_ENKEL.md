# Pantry Tracker — vad det är och hur det fungerar

*En förklaring för den som aldrig skrivit en rad kod.*

---

## Vad appen gör

Det händer oss alla: man öppnar kylen och hittar en yoghurt som gick ut för tre veckor sedan. Eller handlar mjölk en gång till fast det redan finns två kartonger i dörren. Eller inser mitt i matlagningen att det inte finns mer pasta, trots att man var helt säker på att det fanns.

Pantry Tracker är ett verktyg för att slippa allt det där. Du skannar det du lägger in i kylen, frysen och skafferiet — precis som i en butikskassa — och appen kommer ihåg det åt dig. Den vet vad du har, var det finns och när det håller på att gå ut. Är något en stapelvara som alltid ska finnas hemma, till exempel mjölk, märker du det en gång och sedan påminner appen dig automatiskt när det är dags att handla igen.

---

## Det du ser och det som händer bakom kulisserna

Appen är egentligen två saker i en.

Den ena delen är det du ser i webbläsaren: knapparna, listan med varor, kameran som läser streckkoder. Den kallas för *gränssnittet* och körs direkt i din telefon eller dator. Det är den som ritar upp allt snyggt och tar emot dina knapptryckningar.

Den andra delen är osynlig. Det är en liten server — ett program som körs hela tiden på internet — vars enda jobb är att ta emot frågor, leta i databasen och skicka tillbaka svar. Den innehåller inga knappar och ser ingenting. Den bara lyssnar.

En bra liknelse är en restaurang. Det du ser och upplever är matsalen: menyn, dukade bord, servitrisen som tar din beställning. Men maten lagas inte vid bordet — den försvinner in i köket, som du aldrig ser, och kommer tillbaka färdig. Gränssnittet är matsalen. Servern är köket. Och databasen är förrådet där alla råvaror och recept förvaras.

---

## Var datan finns

All information om dina varor — vad det är, hur många det finns, var de ligger, när de går ut — sparas i en databas som heter MongoDB Atlas. Det är en tjänst som bor ute på internet, i ett datacenter i norra Europa.

Tänk på det som en välorganiserad byrålåda. Varje vara är ett kort i lådan. På kortet står namn, märke, streckkod, om det är halvtomt eller fullt, var i hemmet det finns och om det är en stapelvara. Databasen kan ha hur många kort som helst och hittar exakt det rätta kortet på en bråkdels sekund, oavsett om det finns tio eller tiotusen varor.

Det fiffiga med att ha databasen på internet, i stället för i telefonen, är att allting är tillgängligt var du än befinner dig. Du kan stå i affären och kontrollera om det verkligen finns kaffe hemma. Och om telefonen går sönder försvinner inte datan.

---

## Vad som händer när du skannar något

Det här är appens viktigaste funktion, och det sker snabbare än vad man hinner tänka på det.

Du öppnar skanningssidan och håller upp kameran mot en streckkod. Appen tittar på vad kameran ser, bild för bild, hela tiden. När den känner igen en streckkod spelar den ett litet pip — precis som i kassan — och skickar sifferkoden till servern.

Servern tar emot koden och frågar en annan tjänst på internet: Open Food Facts, som är ett öppet register med miljontals livsmedel från hela världen. Där slår den upp produkten och får tillbaka namn, märke och en bild. Det svaret skickar servern vidare till din telefon.

Medan du fortsätter skanna nästa vara lägger appen upp produkten i en lista bredvid kameran. Kameran stannar aldrig — du behöver inte trycka på någon knapp mellan varje vara. Det ska kännas precis som att scanna varor i en butikskassa: en efter en, utan avbrott.

När du är klar med alla varor granskar du listan, väljer om varorna ska till kylen, frysen eller skafferiet, och bekräftar. Då sparas allt på en gång.

Appen kommer också ihåg var du brukar lägga saker. Mjölk hamnar i kylen, toalettpapper i skafferiet. Nästa gång du skannar samma vara föreslår den platsen automatiskt, märkt med en liten nål-ikon.

---

## Hur appen ser ut på olika skärmar

Appen är byggd för att fungera på tre olika sätt beroende på var du befinner dig.

**På telefonen** är det skanningsvyn som är i centrum. Knappar och menyer sitter längst ner på skärmen, precis där tummarna är, så du kan använda den med en hand medan du håller en mjölkförpackning i den andra.

**På en surfplatta monterad på kylskåpet** är det översiktsvyn som passar bäst. Den visar på ett ögonblick hur många varor du har i kylen, frysen och skafferiet, och varnar tydligt om något håller på att gå ut. Det är en vy man bara tittar på, inte interagerar med mycket — lite som en whiteboard på kylskåpet, fast den uppdateras automatiskt.

**På datorn** kan man enkelt söka, redigera och hålla ordning på varor i lugn och ro, med ett större tangentbord och mer plats på skärmen.

Det är tekniskt sett samma app oavsett var du öppnar den, men layouten anpassar sig automatiskt efter skärmens storlek. Menyerna byter plats, korten blir lite större eller mindre, och vad som visas tydligast ändras beroende på vad som passar för situationen.

---

## Varför det ser ut och fungerar som det gör

**Varför kameran är det primära sättet att lägga in varor** — Alternativet är att skriva in allting för hand: namn, märke, nummer. Det fungerar för en vara, men blir snabbt tröttande om man precis kommit hem från affären med en hel kasserull. En streckkodsskanner i kassan tar under en sekund per vara, och det är den känslan appen försöker återskapa. Håll upp kameran, pip, nästa. Ingen skrivning, inget letande.

**Varför det finns en lista man bekräftar i efterhand, i stället för att varje vara sparas direkt** — Ibland skannar man fel, eller vill ändra antal eller var man lagt varan. Listan ger ett ögonblick att dubbelkolla allting innan det sparas. Det är som att ha alla varor på rullbandet innan kassörskan börjar scanna — du ser vad som är på väg in och kan ta bort något om det behövs.

**Varför appen påminner om utgångsdatum** — Det är lätt att tappa koll, särskilt på varor som hamnar längst in i kylen. Att behöva leta efter datum på varje förpackning varje dag är inte realistiskt. Appen vet om det och berättar proaktivt: "den här yoghurten går ut imorgon". Varningen syns redan i navigeringsmenyn som en liten röd siffra, utan att man behöver öppna någon speciell vy.

**Varför appen vet om det är dags att handla** — Om man märkt att något är en stapelvara — något man alltid vill ha hemma — så räcker det att säga det en gång. Appen håller koll på om varan finns kvar. Tar man slut på den sista förpackningen dyker den automatiskt upp på inköpslistan, utan att man behöver komma ihåg att lägga dit den.

---

## Nytt sedan senast

**Dealsfliken** — Inköpslistan har fått en ny flik som heter "Deals 🏷️". Där hämtar appen automatiskt veckans erbjudanden från svenska matbutiker och matchar dem mot varorna på din inköpslista. Om Tropicana apelsinjuice kostar 29 kr på ICA just nu och du har den på listan syns det som en liten märkning direkt på varan. Om du tillåter att appen vet var du är kan den också visa vilken specifik butik som är närmast dig — till exempel "ICA Kvantum Hötorget" i stället för bara "ICA Kvantum". Erbjudandena hämtas från Tjek, en tjänst som samlar reklamblad från svenska livsmedelskedjor.

**Ny lagervy** — Lagersidan ser ut på ett nytt sätt. I stället för en lång lista med stora kort visas varorna nu i ett kompakt rutnät — två kolumner i taget på telefonen, fler på en större skärm. Varje ruta visar produktnamn, märke och en färgad remsa längst ner som visar hur mycket som är kvar (grön = gott om, gul = håller på, röd = nästan slut). Längst upp finns knappar för att filtrera per plats: allt, kylen, frysen, skafferiet eller övrigt. Det gör det lättare att snabbt kolla vad som finns hemma — till exempel när man står i affären och undrar om det verkligen finns pasta.
