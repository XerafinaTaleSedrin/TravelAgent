// Static market data for Grand Carcassonne region
// This supplements the scraped data with known market schedules

const MARKET_SCHEDULE = {
  monday: [
    {
      title: "Montolieu Farmers Market",
      description: "Farmers sale Les Ares Verts (route de Carcassonne) from 5 to 7 pm",
      location: "Montolieu",
      time: "17:00-19:00"
    }
  ],
  tuesday: [
    {
      title: "Caunes-Minervois Market",
      description: "Local market in beautiful medieval village",
      location: "Caunes-Minervois"
    },
    {
      title: "Carcassonne Place Carnot Market", 
      description: "Smaller market in the heart of Carcassonne",
      location: "Carcassonne - Place Carnot"
    },
    {
      title: "Rieux-Minervois Market",
      description: "Traditional village market",
      location: "Rieux-Minervois"
    },
    {
      title: "Val de Dagne Market",
      description: "Market in Montlaur from 4:30 pm",
      location: "Montlaur",
      time: "16:30+"
    }
  ],
  wednesday: [
    {
      title: "La Redorte Market",
      description: "Mid-week village market",
      location: "La Redorte"
    },
    {
      title: "Laure-Minervois Market", 
      description: "Local produce market",
      location: "Laure-Minervois"
    },
    {
      title: "Douzens Night Market",
      description: "Nocturnal market in summer",
      location: "Douzens",
      seasonal: "summer"
    }
  ],
  thursday: [
    {
      title: "Alzonne Market",
      description: "Local market day",
      location: "Alzonne"
    },
    {
      title: "Caunes-Minervois Market",
      description: "Second market day of the week",
      location: "Caunes-Minervois"
    },
    {
      title: "Carcassonne Place Carnot Market",
      description: "Smaller Thursday market",
      location: "Carcassonne - Place Carnot"
    },
    {
      title: "Rieux-Minervois Market",
      description: "Second weekly market",
      location: "Rieux-Minervois"
    }
  ],
  friday: [
    {
      title: "Azille Market",
      description: "End of week market",
      location: "Azille"
    },
    {
      title: "Moussoulens Market",
      description: "Fruit and vegetables market",
      location: "Moussoulens"
    },
    {
      title: "Lespinassiere Market",
      description: "Seasonal market (June-October, 5-7 pm)",
      location: "Lespinassiere",
      time: "17:00-19:00",
      seasonal: "June-October"
    },
    {
      title: "Montolieu Domaine Market",
      description: "Farmers sale at Domaine de Peyremale (10 am-12 pm)",
      location: "Montolieu - Domaine de Peyremale",
      time: "10:00-12:00"
    },
    {
      title: "Rieux-en-Val Market",
      description: "Evening market (5:30-7:30 pm)",
      location: "Rieux-en-Val",
      time: "17:30-19:30"
    }
  ],
  saturday: [
    {
      title: "Carcassonne Main Market",
      description: "LARGEST MARKET - Boulevard du Commandant Roumens - The main weekly market with everything from fresh produce to local specialties",
      location: "Carcassonne - Boulevard du Commandant Roumens",
      time: "08:00-13:00"
    },
    {
      title: "Carcassonne Place Carnot Market",
      description: "Historic central market in the heart of Carcassonne",
      location: "Carcassonne - Place Carnot", 
      time: "08:00-13:00"
    },
    {
      title: "Caunes-Minervois Saturday Market",
      description: "Weekend market in beautiful medieval village famous for its red marble",
      location: "Caunes-Minervois",
      time: "08:00-12:00"
    },
    {
      title: "Rieux-Minervois Saturday Market",
      description: "Traditional Saturday village market",
      location: "Rieux-Minervois",
      time: "08:00-12:00"
    },
    {
      title: "Comigne Saturday Market",
      description: "Small village Saturday market",
      location: "Comigne",
      time: "08:00-12:00"
    }
  ],
  sunday: [
    {
      title: "Trèbes Market",
      description: "Sunday market on Canal du Midi port (winter: in front of town hall)",
      location: "Trèbes - Canal du Midi port"
    },
    {
      title: "Vide-greniers et marché aux puces - Bram",
      description: "Vide-grenier starting at 7:00 AM - Free entry for visitors, on-site restaurant with rotisserie, professional watchmaker for repairs",
      location: "7, Avenue de la Piège, Bram",
      time: "07:00-18:00",
      type: "vide-grenier"
    },
    {
      title: "Vide grenier, marché de producteurs, créateurs - La Force",
      description: "Combined vide-grenier, producers market, and creators market - Free entry, children's games, vintage vehicle exhibition, 50 exhibitors expected",
      location: "La Force",
      time: "09:00-17:00",
      type: "vide-grenier"
    }
  ]
};

function getMarketSchedule() {
  return MARKET_SCHEDULE;
}

function getTodayMarkets() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  return MARKET_SCHEDULE[today] || [];
}

function getAllMarkets() {
  const allMarkets = [];
  Object.entries(MARKET_SCHEDULE).forEach(([day, markets]) => {
    markets.forEach(market => {
      allMarkets.push({
        ...market,
        date: day.charAt(0).toUpperCase() + day.slice(1),
        type: 'markets',
        source: 'Grand Carcassonne Market Schedule',
        score: 100
      });
    });
  });
  return allMarkets;
}

module.exports = { getMarketSchedule, getTodayMarkets, getAllMarkets };