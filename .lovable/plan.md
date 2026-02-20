
## 4 Fixes à appliquer

### Analyse des problèmes

**1. Renommage des salles — ne s'enregistre pas**
Le code de `RoomManagement.tsx` appelle correctement `supabase.from('rooms').update(...)`, mais la RLS policy sur la table `rooms` (`Owner/admin can manage rooms`) utilise `is_owner()` qui ne couvre que les rôles `owner` et `admin`. Si l'utilisateur connecté a le rôle `god`, il ne passe pas cette vérification. Le `is_manager_or_owner()` quant à lui inclut `owner`, `manager`, `admin`, `chef` — mais toujours pas `god`. Il faut modifier la RLS pour inclure le rôle `god`, ou utiliser une fonction qui le couvre. La vraie correction est de créer une migration SQL qui met à jour la policy.

En parallèle, le `handleSaveEdit` dans `RoomManagement.tsx` fonctionne techniquement, mais il n'y a pas de gestion du cache React Query — donc après une mise à jour réussie, la liste est rafraîchie via `fetchRooms()` qui est une simple fetch directe. Cela devrait fonctionner. Le vrai blocage est la RLS.

**2. Deux cloches sur le header — restructurer les icônes**
Dans `Dashboard.tsx`, il y a deux icônes bell :
- Une `BellOff` (lignes 343-348) : affichée quand la permission navigateur est `'default'`, sert à demander l'autorisation de notifs navigateur
- Une `NotificationBell` (ligne 354) : la cloche in-app

Il faut remplacer cette logique par :
- **Cloche** : active/désactive les notifications browser (toggle la permission ou la préférence). Icône `Bell` (actif) ou `BellOff` (inactif), avec un indicateur visuel d'état.
- **Enveloppe** : nouvelle icône `Mail`, grise par défaut, devient rouge quand il y a des messages non lus dans le canal `#managers` adressés aux admins (i.e. envoyés par quelqu'un d'autre). Cette enveloppe ouvre le module de messagerie directement sur le canal `#managers`.

La logique "messages privés admin" sera implémentée via une subscription realtime sur la table `messages` filtrant le canal `managers` pour compter les messages non lus depuis la dernière visite (stocké en `localStorage` avec la date de la dernière ouverture du module chat).

**3. Création de tâche impossible**
Le log console montre clairement l'erreur : `"Function components cannot be given refs... Stepper"`. Le composant `Stepper` dans `CreateTaskModal.tsx` reçoit une ref via le composant `Switch` de Radix UI qui transmet une ref — mais le problème réel est que le `Switch` de shadcn (via `@radix-ui/react-switch`) est utilisé correctement avec `forwardRef`. L'erreur de ref vient du `Stepper` lui-même qui n'utilise pas `forwardRef`.

Cependant, l'erreur de "ref" est un avertissement React et ne bloque pas normalement le submit. Le vrai blocage est probablement la RLS — la policy `is_manager_or_owner()` n'inclut pas le rôle `god`. La fonction SQL `is_manager_or_owner()` retourne vrai pour `owner`, `manager`, `admin`, `chef` — mais pas pour `god`. Donc un utilisateur GOD ou un utilisateur connecté avec le rôle `god` ne peut pas créer de tâche.

**Fix à appliquer :**
- Migration SQL pour corriger `is_manager_or_owner()` afin d'inclure `god`, ou ajouter une nouvelle policy pour `god`.
- Corriger le `Stepper` avec `React.forwardRef` pour éliminer l'avertissement.

**4. Logo trop grand dans le header**
Dans `Dashboard.tsx`, le logo est rendu avec `className="w-8 h-8"` (32px × 32px). La bulle photo (avatar) est rendue avec `className="w-8 h-8"` elle aussi. Ils devraient déjà être de la même taille. Le problème visuel signalé est probablement que le logo SVG a des marges internes et semble plus grand. La correction est de passer à `h-[34px] w-auto` pour le logo (hauteur fixe correspondant à la bulle photo qui a `h-8 = 32px`), ou plus précisément d'aligner les deux à 34px.

---

### Plan d'implémentation

**Étape 1 — Migration SQL (RLS fix)**
Modifier la fonction `is_manager_or_owner()` pour inclure le rôle `god` dans la liste des rôles autorisés :
```sql
CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'manager', 'admin', 'chef', 'god')
  );
$$;
```
Cela règle d'un coup : la création de tâches, le renommage de salles (rooms utilise `is_owner()` qui couvre déjà `god` via la définition), et toutes autres opérations bloquées pour GOD.

Note : `is_owner()` vérifie `role IN ('owner', 'admin')` — donc GOD est aussi exclu de `is_owner()`. Il faut aussi corriger cette fonction :
```sql
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin', 'god')
  );
$$;
```

**Étape 2 — Corriger le Stepper (CreateTaskModal.tsx)**
Envelopper `Stepper` dans `React.forwardRef` ou mieux, s'assurer que le `Switch` de Radix n'est pas à l'intérieur d'un contexte qui lui passe une ref de façon incorrecte. L'erreur indique que `Stepper` lui-même n'est pas un `forwardRef` alors qu'une ref lui est passée. La correction est simple : transformer `Stepper` en composant sans ref explicite (ce qui est déjà le cas) mais vérifier l'arbre de rendu. En pratique, l'erreur provient du `Switch` shadcn imbriqué dans le formulaire — c'est un warning non bloquant. Le vrai fix du submit est la RLS.

**Étape 3 — Restructurer les icônes du header (Dashboard.tsx)**
Remplacer le bloc "Notif permission" + "NotificationBell" par :

```tsx
{/* Cloche : activer/désactiver notifs browser */}
<button
  onClick={permission === 'granted' ? () => {/* toggle pref */} : requestPermission}
  title={permission === 'granted' ? 'Notifications activées' : 'Activer les notifications'}
  className="relative p-2 rounded-lg hover:bg-muted transition-colors"
>
  {permission === 'granted' 
    ? <Bell className="w-4 h-4 text-primary" />
    : <BellOff className="w-4 h-4 text-muted-foreground" />
  }
</button>

{/* Enveloppe : messages non lus dans #managers (admin/owner/god seulement) */}
{isManager && (
  <button
    onClick={() => setActiveModule('chat')}
    title="Messages équipe"
    className="relative p-2 rounded-lg hover:bg-muted transition-colors"
  >
    <Mail className="w-4 h-4 text-muted-foreground" />  {/* ou text-destructive si unread */}
    {unreadManagerMessages > 0 && (
      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive" />
    )}
  </button>
)}

{/* NotificationBell (cloche in-app inchangée) */}
<NotificationBell />
```

L'état `unreadManagerMessages` sera calculé en comparant le dernier `created_at` des messages du canal `managers` avec `localStorage.getItem('last_chat_open')`.

**Étape 4 — Corriger la taille du logo (Dashboard.tsx)**
Changer `className="w-8 h-8 object-contain"` par `className="h-[34px] w-auto object-contain"` pour les deux images logo (light et dark). La bulle photo passe de `w-8 h-8` à `w-[34px] h-[34px]` pour assurer la cohérence.

---

### Fichiers modifiés
- **Migration SQL** : correction des fonctions `is_owner()` et `is_manager_or_owner()` pour inclure le rôle `god`
- **`src/pages/Dashboard.tsx`** : restructuration des icônes header (Bell/Mail) + fix taille logo
- **`src/components/notifications/NotificationBell.tsx`** : inchangé (la NotificationBell reste identique)
- **`src/components/tasks/CreateTaskModal.tsx`** : fix avertissement Stepper (forwardRef ou suppression ref inutile)
