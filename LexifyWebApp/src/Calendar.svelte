<script>
  export let quizCounts = {};

  const DAYS_IN_WEEK = 7;
  const WEEKS_TO_SHOW = 31;

  let calendar = [];
  let monthLabels = {};

  $: {
    const today = new Date();
    
    // 1. Find the "End of the Current Week" (Next Sunday)
    // d.getDay() is 0 for Sunday, 1 for Monday...
    // We want to find how many days to add to get to Sunday (0)
    const dayOfWeek = today.getDay(); 
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysUntilSunday);
    endDate.setHours(0, 0, 0, 0);

    // 2. Build grid
    calendar = Array.from({ length: WEEKS_TO_SHOW }, () =>
      Array(DAYS_IN_WEEK).fill({ date: null, count: 0 })
    );

    const totalDays = WEEKS_TO_SHOW * DAYS_IN_WEEK;
    const allCounts = [];

    // 3. Fill from the future-most Sunday backwards
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - i);
      
      const dateStr = d.toISOString().slice(0, 10);
      const count = parseInt(quizCounts[dateStr] || 0);
      
      // Calculate position in the 31-column grid
      // (totalDays - 1 - i) ensures the oldest date is index 0, newest is index 216
      const reverseIndex = totalDays - 1 - i;
      const weekIndex = Math.floor(reverseIndex / DAYS_IN_WEEK);
      const dayIndex = (d.getDay() + 6) % 7; // Convert to Mon=0, Sun=6

      calendar[weekIndex][dayIndex] = { date: dateStr, count };
      allCounts.push(count);
    }

    // Stats for coloring
    const maxCount = Math.max(...allCounts, 1);
    calendar.maxCount = maxCount;

    // 4. Month labels
    monthLabels = {};
    calendar.forEach((week, col) => {
      // Check the first day of the week
      const firstDay = week[0]; 
      if (firstDay && firstDay.date) {
        const d = new Date(firstDay.date);
        // If the 1st of the month falls in this week, label it
        if (d.getDate() <= 7) {
          monthLabels[col] = d.toLocaleString("default", { month: "short" });
        }
      }
    });
  }

  function color(count) {
    if (count === 0) return "#ebedf0";
    const shades = ["#c6e48b", "#7bc96f", "#239a3b", "#196127", "#144d24", "#0f361a"];
    const level = Math.min(shades.length - 1, Math.floor((count / calendar.maxCount) * shades.length));
    return shades[level];
  }
</script>

<div class="month-labels">
  {#each Array(WEEKS_TO_SHOW) as _, col}
    <div class="month-wrapper">
       <span class="month">{monthLabels[col] || ''}</span>
    </div>
  {/each}
</div>

<div class="calendar">
  {#each Array(DAYS_IN_WEEK) as _, row}
    {#each calendar as week}
      <div
        class="cell"
        style="background-color: {color(week[row]?.count || 0)}"
        title="{week[row]?.date}: {week[row]?.count || 0} quizzes"
      />
    {/each}
  {/each}
</div>

<style>
  .month-labels {
    display: grid;
    grid-template-columns: repeat(31, 9px);
    gap: 2px;
    justify-content: center;
    font-size: 0.5rem; /* Shrunk slightly to fit labels better */
    margin-bottom: 4px;
    height: 12px;
    color: #888;
  }
  
  .month-wrapper {
    position: relative;
  }

  .month {
    position: absolute;
    left: 0;
    white-space: nowrap;
  }

  .calendar {
    display: grid;
    grid-template-columns: repeat(31, 9px);
    grid-template-rows: repeat(7, 9px);
    gap: 2px;
    justify-content: center;
  }

  .cell {
    width: 9px;
    height: 9px;
    border-radius: 1px;
  }
</style>