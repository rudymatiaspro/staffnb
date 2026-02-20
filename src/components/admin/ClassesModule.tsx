/**
 * ClassesModule — GOD/Admin only
 * Allows managing user roles (classes) and their privileges visibility.
 */
import { useState } from 'react';
import { Shield, Info, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

type RoleKey = 'god' | 'admin' | 'owner' | 'manager' | 'chef' | 'staff' | 'station';

interface RoleClass {
  key: RoleKey;
  label: string;
  description: string;
  color: string;
  privileges: { key: string; label: string; description: string }[];
}

const ROLE_CLASSES: RoleClass[] = [
  {
    key: 'god',
    label: 'Divinité',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300',
    description: 'Accès global total. Peut impersonnifier tout compte. Gère tous les restaurants.',
    privileges: [
      { key: 'impersonate', label: 'Impersonnification', description: 'Se connecter en tant que n\'importe quel utilisateur' },
      { key: 'restaurant_mgmt', label: 'Gestion des restaurants', description: 'Créer, modifier, supprimer des restaurants' },
      { key: 'global_view', label: 'Vue globale', description: 'Voir tous les restaurants et leurs données' },
      { key: 'pin_view', label: 'Voir PINs', description: 'Afficher les PINs des profils staff' },
      { key: 'pin_reset', label: 'Réinitialiser PINs', description: 'Forcer la réinitialisation du PIN à la prochaine connexion' },
      { key: 'account_create', label: 'Créer des comptes', description: 'Créer n\'importe quel type de compte' },
      { key: 'account_delete', label: 'Supprimer des comptes', description: 'Supprimer des comptes définitivement' },
      { key: 'classes_mgmt', label: 'Gestion des classes', description: 'Modifier les rôles et privilèges' },
    ],
  },
  {
    key: 'admin',
    label: 'Administrateur',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    description: 'Accès complet à un ou plusieurs restaurants. Peut gérer les membres et les classes.',
    privileges: [
      { key: 'restaurant_select', label: 'Sélection du restaurant', description: 'Choisir son restaurant de travail au login' },
      { key: 'pin_view', label: 'Voir PINs', description: 'Afficher les PINs des profils staff' },
      { key: 'pin_reset', label: 'Réinitialiser PINs', description: 'Forcer la réinitialisation du PIN à la prochaine connexion' },
      { key: 'account_create', label: 'Créer des comptes', description: 'Créer des comptes staff et manager' },
      { key: 'account_delete', label: 'Supprimer des comptes', description: 'Supprimer des comptes (sauf GOD)' },
      { key: 'classes_mgmt', label: 'Gestion des classes', description: 'Modifier les rôles des membres' },
    ],
  },
  {
    key: 'owner',
    label: 'Propriétaire',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    description: 'Propriétaire du restaurant. Accès complet à la gestion opérationnelle.',
    privileges: [
      { key: 'dashboard', label: 'Dashboard complet', description: 'Accès à tous les modules de gestion' },
      { key: 'settings', label: 'Paramètres', description: 'Configuration de la gamification et du restaurant' },
      { key: 'staff_manage', label: 'Gestion du personnel', description: 'Créer et modifier les comptes staff' },
      { key: 'reports', label: 'Rapports', description: 'Rapports de fin de journée et analyses' },
      { key: 'planning', label: 'Planning', description: 'Gestion du planning et des shifts' },
    ],
  },
  {
    key: 'manager',
    label: 'Manager',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    description: 'Manager d\'équipe. Gère les tâches, le pointage et les incidents de son équipe.',
    privileges: [
      { key: 'task_mgmt', label: 'Gestion des tâches', description: 'Créer, assigner et valider les tâches' },
      { key: 'planning', label: 'Planning', description: 'Créer et modifier le planning de son équipe' },
      { key: 'incidents', label: 'Gestion des incidents', description: 'Voir et résoudre les incidents' },
      { key: 'team_scores', label: 'Scores équipe', description: 'Attribuer des bonus/malus aux membres' },
      { key: 'reports', label: 'Rapports', description: 'Accès aux rapports de son équipe' },
    ],
  },
  {
    key: 'chef',
    label: 'Chef',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    description: 'Chef de cuisine / responsable pôle. Accès HACCP, commandes et objectifs.',
    privileges: [
      { key: 'haccp', label: 'HACCP', description: 'Relevés de température et traçabilité' },
      { key: 'orders', label: 'Commandes', description: 'Créer et approuver des commandes fournisseurs' },
      { key: 'objectives', label: 'Objectifs', description: 'Voir et gérer les objectifs d\'équipe' },
      { key: 'tasks', label: 'Tâches', description: 'Valider et compléter les tâches' },
    ],
  },
  {
    key: 'staff',
    label: 'Équipier',
    color: 'bg-slate-100 text-slate-800 dark:bg-slate-950/40 dark:text-slate-300',
    description: 'Membre de l\'équipe opérationnelle. Accès aux tâches, pointage et messagerie.',
    privileges: [
      { key: 'tasks', label: 'Tâches', description: 'Voir et compléter les tâches assignées' },
      { key: 'timeclock', label: 'Pointage', description: 'Enregistrer les entrées et sorties' },
      { key: 'chat', label: 'Messagerie', description: 'Communication avec l\'équipe' },
      { key: 'scores', label: 'Mon Score', description: 'Voir son score personnel et son classement' },
      { key: 'planning', label: 'Planning', description: 'Consulter son planning (lecture seule)' },
    ],
  },
  {
    key: 'station',
    label: 'Station',
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300',
    description: 'Compte de terminal de restaurant. Accès au menu du jour et suivi en temps réel.',
    privileges: [
      { key: 'station_view', label: 'Vue Station', description: 'Affichage du menu, des commandes et des alertes' },
      { key: 'pin_6digits', label: 'PIN 6 chiffres', description: 'Authentification par PIN 6 chiffres dédié' },
      { key: 'auto_logout', label: 'Déconnexion automatique', description: 'Session expirée automatiquement à minuit' },
    ],
  },
];

export function ClassesModule() {
  const [expandedRole, setExpandedRole] = useState<RoleKey | null>('god');
  const [showInfo, setShowInfo] = useState(false);

  const toggleRole = (key: RoleKey) => {
    setExpandedRole(prev => prev === key ? null : key);
  };

  return (
    <div className="space-y-4">

      {/* Header info */}
      <div className="glass-card rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-foreground">Gestion des Classes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vue des rôles et de leurs privilèges système. Les rôles sont définis au niveau de l'application.
          </p>
          <button
            onClick={() => setShowInfo(v => !v)}
            className="mt-1.5 text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Info className="w-3 h-3" />
            {showInfo ? 'Masquer les informations' : 'À propos des classes'}
          </button>
          {showInfo && (
            <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/15 text-xs text-muted-foreground space-y-1">
              <p>• Les classes (rôles) déterminent les permissions dans l'application.</p>
              <p>• GOD et Admin gèrent les membres via le module <strong>Membres</strong>.</p>
              <p>• Chaque classe dispose d'un accès spécifique aux modules du tableau de bord.</p>
              <p>• La hiérarchie : Divinité &gt; Administrateur &gt; Propriétaire &gt; Manager &gt; Chef &gt; Équipier &gt; Station</p>
            </div>
          )}
        </div>
      </div>

      {/* Role cards */}
      <div className="space-y-2">
        {ROLE_CLASSES.map((cls) => {
          const isExpanded = expandedRole === cls.key;
          return (
            <div key={cls.key} className="glass-card rounded-xl overflow-hidden">
              <button
                onClick={() => toggleRole(cls.key)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${cls.color}`}>
                    {cls.label}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{cls.description}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">{cls.privileges.length} privilèges</span>
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  }
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border px-4 pb-4">
                  <p className="text-xs text-muted-foreground py-3 sm:hidden">{cls.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cls.privileges.map((priv) => (
                      <div key={priv.key} className="flex items-start gap-2.5 p-2.5 bg-muted/40 rounded-lg">
                        <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{priv.label}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{priv.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Légende */}
      <div className="glass-card rounded-xl p-3 flex flex-wrap gap-2">
        {ROLE_CLASSES.map((cls) => (
          <span key={cls.key} className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls.color}`}>
            {cls.label}
          </span>
        ))}
      </div>
    </div>
  );
}
