<script>
  export let quizCounts = {};

  const DAYS_IN_WEEK = 7;
  const WEEKS_TO_SHOW = 31;
  const today = new Date();

  let calendar = [];
  let monthLabels = {};

  // Reactive update whenever quizCounts changes
  $: {
    // Build calendar grid: weeks x days
    calendar = Array.from({ length: WEEKS_TO_SHOW }, () =>
      Array(DAYS_IN_WEEK).fill({ date: null, count: 0 })
    );

    const allCounts = [];

    const totalDays = WEEKS_TO_SHOW * DAYS_IN_WEEK;

    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const d = new Date(today);
      d.setDate(today.getDate() - (totalDays - 1 - dayOffset));

      const date = d.toISOString().slice(0, 10);
      const dayOfWeek = (d.getDay() + 6) % 7; // Monday = 0
      const weekIndex = Math.floor(dayOffset / DAYS_IN_WEEK);

      const count = parseInt(quizCounts[date] || 0);
      allCounts.push(count);

      calendar[weekIndex][dayOfWeek] = { date, count };
    }

    // Compute min and max for levels
    const maxCount = Math.max(...allCounts, 1); // at least 1
    calendar.levels = [0, 1, 2, 3, 4, 5]; // 6 levels

    // Month labels: first week of each month
    monthLabels = {};
    for (let col = 0; col < WEEKS_TO_SHOW; col++) {
      const week = calendar[col];
      const firstDay = week.find(d => d.date);
      if (!firstDay) continue;
      const day = new Date(firstDay.date).getDate();
      const month = new Date(firstDay.date).toLocaleString("default", { month: "short" });
      if (day <= 7) monthLabels[col] = month;
    }

    calendar.maxCount = maxCount;
  }

  // Map count to one of 6 shades
  function color(count) {
    if (count === 0) return "#ebedf0";

    const shades = [
      "#c6e48b",
      "#7bc96f",
      "#239a3b",
      "#196127",
      "#144d24",
      "#0f361a"
    ];

    const level = Math.min(
      shades.length - 1,
      Math.floor((count / calendar.maxCount) * shades.length)
    );

    return shades[level];
  }
</script>

<div class="month-labels">
  {#each Array(WEEKS_TO_SHOW) as _, col}
    <span class="month">{monthLabels[col] || ''}</span>
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
    gap: 2px;                /* 🔑 MUST match calendar */
    justify-content: center;
    font-size: 0.6rem;
    margin-bottom: 4px;
  }
  .month {
    text-align: center;
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
    border-radius: 2px;
  }

</style>
