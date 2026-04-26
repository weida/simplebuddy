#include <stdio.h>
#include <stdbool.h>
#include "list.h"
#include "buddy.h"

#define page_private(page)	((page)->private)
#define set_page_private(page, v) ((page)->private = (v))

unsigned int
page_order (struct page *page)
{
  return page_private (page);
}

bool
page_is_buddy (struct page * buddy, unsigned int order)
{
  if (!PageBuddy (buddy))
    return false;
  if (page_order (buddy) != order)
    return false;
  return true;
}

struct page *
get_page_from_free_area (struct free_area *area)
{
  return list_first_entry_or_null (&area->free_list, struct page, lru);
}

void expand (struct page *page, int low, int high);
void del_page_from_free_list (struct page *page, unsigned int order);

struct page *
alloc_pages (unsigned int order)
{

  unsigned int current_order;
  struct page *page;
  struct free_area *area;

  for (current_order = order; current_order < MAX_ORDER; ++current_order)
    {

      area = free_area + current_order;
      page = get_page_from_free_area (area);

      if (!page)
	continue;

      del_page_from_free_list (page, current_order);
      expand (page, order, current_order);
      return page;
    }
}


void
del_page_from_free_list (struct page *page, unsigned int order)
{
  list_del (&page->lru);
  __ClearPageBuddy (page);
  set_page_private (page, 0);
  free_area[order].nr_free--;
}

void
add_to_free_list (struct page *page, unsigned int order)
{
  list_add (&page->lru, &free_area[order].free_list);
  free_area[order].nr_free++;
}


void set_page_order (struct page *page, unsigned int order);

void
expand (struct page *page, int low, int high)
{
  unsigned long size = 1 << high;
  while (high > low)
    {
      high--;
      size >>= 1;
      add_to_free_list (&page[size], high);
      set_page_order (&page[size], high);

      //only report
      __SetPageReport (page);
      print_free_area (0, high);
    }
    __ClearPageReport (page);

}


void
set_page_order (struct page *page, unsigned int order)
{
  set_page_private (page, order);
  __SetPageBuddy (page);
}



unsigned long
__find_buddy_pfn (unsigned long page_pfn, unsigned int order)
{
  return page_pfn ^ (1 << order);
}

unsigned long
page_to_pfn (struct page *page)
{
  int i;
  for (i = 0; i < MAX_PAGE_NUM; i++)
    {
      if (page == &pages[i])
	{
	  return i;
	}
    }
  return -1;
}

void
free_page (struct page *page, unsigned int order)
{
  __free_one_page (page, page_to_pfn (page), order);
}


void
__free_one_page (struct page *page, unsigned long pfn, unsigned int order)
{
  unsigned int buddy_pfn;
  unsigned int combined_pfn;
  unsigned int _pfn;
  struct page *buddy;

  //only report 
  __SetPageReport (page);
  print_free_area (0, order);

  while (order < MAX_ORDER - 1)
    {
      buddy_pfn = __find_buddy_pfn (pfn, order);
      buddy = page + (buddy_pfn - pfn);

      if (!page_is_buddy (buddy, order))
	break;
      __ClearPageReport (page);

      del_page_from_free_list (buddy, order);
      combined_pfn = buddy_pfn & pfn;
      page = page + (combined_pfn - pfn);
      pfn = combined_pfn;
      order++;
      //only report 
      __SetPageReport (page);
      print_free_area (0, order);
    }

  set_page_order (page, order);
  add_to_free_list (page, order);

  __ClearPageReport (page);
}


void
memmap_init_zone ()
{
  struct page *page = NULL;
  int i;
  for (i = 0; i < MAX_PAGE_NUM; i++)
    {
      page = pages + i;
      INIT_LIST_HEAD (&(page->lru));
      memset (page, 0, sizeof (struct page));
      page->page_type = -1;
      __ClearPageBuddy (page);
      //__ClearPageReport (page);
      set_page_private (page, 0);
      page->process.pid = 0;
    }

  return;
}

void
zone_init_free_list ()
{
  struct free_area *area = NULL;
  int i;
  for (i = 0; i < MAX_ORDER; i++)
    {
      area = free_area + i;
      INIT_LIST_HEAD (&area->free_list);
      area->nr_free = 0;
    }
  return;

}

void
mm_init ()
{
  int i;
  int order = MAX_ORDER - 1;
  struct page *page;
  page = &pages[0];
  free_page (page, order);

}

void
free_area_init_core ()
{
  zone_init_free_list ();
  memmap_init_zone ();
  mm_init ();
  return;

}


void
print_free_area_head ()
{
  int i;
  printf (" step");
  for (i = 0; i < MAX_PAGE_NUM; i++)
    {
      printf ("| 64K ");
    }
  printf ("|\n");
}


void
print_no (int cnt)
{
  if (!cnt)
     printf ("     ");
  else
     printf (" %-3d ", cnt);
}

void
print_free_area (int cnt, int order)
{
  print_no (cnt);
  if (!cnt)
      print_free_area_detail_inside (order);
  else
      print_free_area_detail ();
}

void
print_free_area_detail ()
{
  int i;
  for (i = 0; i < MAX_PAGE_NUM; i++)
    {
      if (pages[i].process.pid != 0)
	{
	  printf ("|%c:2^%d", pages[i].process.pid, pages[i].process.private);
	}
      else if (PageBuddy (&pages[i]))
	{
	  //} else if (PageBuddy(&pages[i])) {
	  printf ("|");
	  printf ("2^%d  ", pages[i].private);
	}
      else
	printf ("      ");
    }
  printf ("\n");
  return;
}

void
print_free_area_detail_inside (int order)
{
  int i;
  for (i = 0; i < MAX_PAGE_NUM; i++)
    {
      if (pages[i].process.pid != 0)
	{
	  printf ("|%c:2^%d", pages[i].process.pid, pages[i].process.private);
	}
      else if (PageReport (&pages[i]) )
	{
	  printf ("|");
	  printf ("2^%d  ", order);
	}
      else if (PageBuddy (&pages[i]))
	{
	  printf ("|");
	  printf ("2^%d  ", pages[i].private);
	}
      else
	printf ("      ");
    }
  printf ("\n");
  return;
}

